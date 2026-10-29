import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CloudinaryStorage, cloudinaryConfigFromEnv, signCloudinary } from "@/lib/storage/cloudinary";

const config = { cloudName: "demo", apiKey: "123", apiSecret: "secret", folder: "bridgeone" };

function fakeFetch(responses: Response[]) {
  const calls: { url: string; form?: FormData }[] = [];
  const impl = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), form: init?.body instanceof FormData ? init.body : undefined });
    return responses.shift() ?? new Response("{}", { status: 200 });
  }) as typeof fetch;
  return { impl, calls };
}

describe("Cloudinary storage", () => {
  it("signs sorted parameters with the API secret", () => {
    expect(signCloudinary({ timestamp: "1", public_id: "a" }, "s")).toBe(createHash("sha1").update("public_id=a&timestamp=1s").digest("hex"));
  });

  it("reads its settings from CLOUDINARY_URL or separate variables", () => {
    const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;
    expect(cloudinaryConfigFromEnv(env({ CLOUDINARY_URL: "cloudinary://k:s@c" }))).toEqual({ cloudName: "c", apiKey: "k", apiSecret: "s", folder: "bridgeone" });
    expect(() => cloudinaryConfigFromEnv(env({}))).toThrow(/CLOUDINARY_CLOUD_NAME/);
  });

  it("uploads under the folder without file extensions, refuses re-used keys and maps 404 to null", async () => {
    const { impl, calls } = fakeFetch([
      Response.json({ public_id: "bridgeone/offices/1/logo-x_png" }),
      Response.json({ existing: true }),
      new Response("", { status: 404 }),
    ]);
    const storage = new CloudinaryStorage(config, impl);
    await storage.put("offices/1/logo-x.png", new Uint8Array([1]));
    expect(calls[0].url).toBe("https://api.cloudinary.com/v1_1/demo/raw/upload");
    expect(calls[0].form?.get("public_id")).toBe("bridgeone/offices/1/logo-x_png");
    expect(calls[0].form?.get("api_key")).toBe("123");
    await expect(storage.put("offices/1/logo-x.png", new Uint8Array([1]))).rejects.toThrow(/already exists/);
    expect(await storage.get("missing")).toBeNull();
    expect(calls[2].url).toBe("https://res.cloudinary.com/demo/raw/upload/bridgeone/missing");
    await expect(storage.put("../escape", new Uint8Array([1]))).rejects.toThrow(/Invalid storage key/);
  });
});
