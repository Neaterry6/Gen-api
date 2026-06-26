// api/generate.js - Vercel Serverless Function
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method!== 'POST' && req.method!== 'GET') {
    return res.status(405).json({ success: false, error: "Use POST or GET" });
  }

  try {
    // URL: /api/generate/pollinations/cute+cat/image/1024/1024
    // req.url = "/api/generate/pollinations/cute+cat/image/1024/1024"
    const parts = req.url.replace('/api/generate/', '').split('/');
    const [providerRaw, promptRaw, type = "image", width = "1024", height = "1024", duration = "5", seed, imageEncoded] = parts;

    if (!providerRaw ||!promptRaw) {
      return res.status(400).json({
        success: false,
        error: "Format: /api/generate/{provider}/{prompt}/{type?}",
        example: "/api/generate/pollinations/cute+cat/image"
      });
    }

    const provider = providerRaw.toLowerCase();
    const prompt = decodeURIComponent(promptRaw.replace(/\+/g, "));
    const w = parseInt(width) || 1024;
    const h = parseInt(height) || 1024;
    const dur = Math.min(parseInt(duration) || 5, 10);
    const randomSeed = seed? parseInt(seed) : Math.floor(Math.random() * 999);

    const uploadImageOrVideo = async (url) => {
      try {
        const uploadRes = await fetch("https://apis.malvryx.dev/api/uploader/malvryx-temp", {
          method: "POST",
          headers: { "X-API-Key": process.env.MALVRYX_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ url, type: "temp", expiry: "7d" })
        });
        const data = await uploadRes.json();
        return data.url || data.link || url;
      } catch { return url; }
    };

    // CHAT: No upload
    if (type === "chat" || provider === "chat") {
      const chatRes = await fetch("https://gen.pollinations.ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }] })
      });
      const chatData = await chatRes.json();
      return res.status(200).json({
        success: true, provider: "pollinations-chat", type: "chat", prompt,
        response: chatData.response || chatData.text || chatData.content || JSON.stringify(chatData)
      });
    }

    // POLLINATIONS
    if (provider === "pollinations" || provider === "gen") {
      let model = "flux";
      let endpoint = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?seed=${randomSeed}&width=${w}&height=${h}&nologo=true`;

      if (type === "video") {
        endpoint = `https://video.pollinations.ai/prompt/${encodeURIComponent(prompt)}?duration=${dur}&seed=${randomSeed}`;
        model = "seedance";
      } else if (type === "edit") {
        if (!imageEncoded) return res.status(400).json({ success: false, error: "Edit needs 7th param = encoded image URL" });
        endpoint += `&image=${encodeURIComponent(decodeURIComponent(imageEncoded))}`;
        model = "flux-edit";
      }

      const finalUrl = await uploadImageOrVideo(endpoint);
      return res.status(200).json({ success: true, provider: "pollinations", type, prompt, model, url: finalUrl });
    }

    // FLUX HF
    if (provider === "flux") {
      const response = await fetch("https://router.huggingface.co/fal-ai/fal-ai/flux/schnell", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.HF_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, width: w, height: h, seed: randomSeed })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Flux failed");
      const finalUrl = await uploadImageOrVideo(data.images?.[0]?.url || data.image);
      return res.status(200).json({ success: true, provider: "flux-schnell", type: "image", prompt, url: finalUrl });
    }

    // OTHER MODELS
    const imageModels = {
      "sd3.5": "sd3.5-medium", "nano-banana": "nano-banana-2",
      "seedream": "seedream-5.0", "photon": "photon", "ideogram": "ideogram-v2"
    };
    if (imageModels[provider]) {
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?model=${imageModels[provider]}&seed=${randomSeed}&width=${w}&height=${h}&nologo=true`;
      const finalUrl = await uploadImageOrVideo(url);
      return res.status(200).json({ success: true, provider, type: "image", prompt, model: imageModels[provider], url: finalUrl });
    }

    return res.status(400).json({ success: false, error: "Unsupported provider" });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
