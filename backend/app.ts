import express from "express";
import { createClient } from "redis";
import { json } from "body-parser";

const DEFAULT_BALANCE = 100;

interface ScriptResult {
    '0': string
    '1': number
}

interface ChargeResult {
    isAuthorized: boolean;
    remainingBalance: number;
    charges: number;
}

async function connect(): Promise<ReturnType<typeof createClient>> {
    const url = `redis://${process.env.REDIS_HOST ?? "localhost"}:${process.env.REDIS_PORT ?? "6379"}`;
    console.log(`Using redis URL ${url}`);
    const client = createClient({ url });
    await client.connect();
    return client;
}

async function reset(account: string): Promise<void> {
    const client = await connect();
    try {
        await client.set(`${account}/balance`, DEFAULT_BALANCE);
    } finally {
        await client.disconnect();
    }
}

async function charge(account: string, charges: number): Promise<ChargeResult> {
    const client = await connect();
    try {
        const luaScript = `local currentValue = tonumber(redis.call('GET', KEYS[1]))
        local charges = tonumber(KEYS[2])
        local results = {}
        if currentValue and currentValue >= charges then
            redis.call('DECRBY', KEYS[1], charges)
            results[#results+1] = 'true'
            results[#results+1] = redis.call('GET', KEYS[1])
            return results
        else
            results[#results+1] = 'false'
            results[#results+1] = currentValue
            return results
        end`
        const evalOptions = {
            keys: [`account/balance`, `${charges}`]
          };

        const result = <ScriptResult> <unknown> await client.eval(luaScript, evalOptions)
        return { isAuthorized: result['0'] === "true" ? true : false, remainingBalance: result['1'], charges: result['0'] === "true" ? charges : 0}
    } finally {
        await client.disconnect();
    }
}

export function buildApp(): express.Application {
    const app = express();
    app.use(json());
    app.post("/reset", async (req, res) => {
        try {
            const account = req.body.account ?? "account";
            await reset(account);
            console.log(`Successfully reset account ${account}`);
            res.sendStatus(204);
        } catch (e) {
            console.error("Error while resetting account", e);
            res.status(500).json({ error: String(e) });
        }
    });
    app.post("/charge", async (req, res) => {
        try {
            const account = req.body.account ?? "account";
            const result = await charge(account, req.body.charges ?? 10);
            console.log(`Successfully charged account ${account}`);
            res.status(200).json(result);
        } catch (e) {
            console.error("Error while charging account", e);
            res.status(500).json({ error: String(e) });
        }
    });
    return app;
}
