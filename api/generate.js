// pages/api/generate/[...slug].js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    // URL format: /api/generate/{provider}/{prompt}/{type?}/{width?}/{height?}/{duration?}/{seed?}
    const [providerRaw, promptRaw, type = "image", width = "1024", height = "1024", duration = "5", seed] = req.query.slug || [];

    if (!providerRaw || !promptRaw) {
      return res.status(400).json({ success: false, error: "Missing provider or prompt. Format: /api/generate/{provider}/{prompt}/{type}" });
    }

    const provider = providerRaw.toLowerCase();
    const prompt = decodeURIComponent(promptRaw.replace(/\+/g, " "));
    const w = parseInt(width) || 1024;
    const h = parseInt(height) || 1024;
    const dur = Math.min(parseInt(duration) || 5, 10);
    const randomSeed = seed ? parseInt(seed) : Math.floor(Math.random() * 999);

    // ========================
    // UPLOAD HELPER - only for media, not chat
    // ========================
    async function uploadImageOrVideo(url) {
      try {
        const uploadRes = await fetch("https://apis.malvryx.dev/api/uploader/malvryx-temp", {
          method: "POST",
          headers: {
            "X-API-Key": process.env.MALVRYX_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            url: url,
            type: "temp",
            expiry: "7d"
          })
        });
        const data = await uploadRes.json();
        return data.url || data.link || url;
      } catch (e) {
        return url;
      }
    }

    // ========================
    // 1. CHAT - No upload, just return AI reply
    // ========================
    if (type === "chat" || provider === "chat") {
      const chatRes = await fetch("https://gen.pollinations.ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }] })
      });
      const chatData = await chatRes.json();
      
      return res.status(200).json({
        success: true,
        provider: "pollinations-chat",
        type: "chat",
        prompt,
        response: chatData.response || chatData.text || chatData.content || JSON.stringify(chatData),
        model: "pollinations"
      });
    }

    // ========================
    // 2. POLLINATIONS IMAGE/EDIT/VIDEO
    // ========================
    if (provider === "pollinations" || provider === "gen") {
      let model = "flux";
      let endpoint = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?seed=${randomSeed}&width=${w}&height=${h}&nologo=true`;

      if (type === "video") {
        endpoint = `https://video.pollinations.ai/prompt/${encodeURIComponent(prompt)}?duration=${dur}&seed=${randomSeed}`;
        model = "seedance";
      } else if (type === "edit") {
        // Usage: /api/generate/pollinations/prompt/edit/1024/1024/5/seed/image_url_encoded
        const imageUrl = req.query.slug[6]; // 7th param
        if (!imageUrl) {
          return res.status(400).json({ success: false, error: "Edit requires image URL as 7th param" });
        }
        endpoint += `&image=${encodeURIComponent(decodeURIComponent(imageUrl))}`;
        model = "flux-edit";
      }

      const finalUrl = await uploadImageOrVideo(endpoint);
      return res.status(200).json({
        success: true,
        provider: "pollinations",
        type,
        prompt,
        model,
        url: finalUrl
      });
    }

    // ========================
    // 3. FLUX SCHNELL HF
    // ========================
    if (provider === "flux") {
      const response = await fetch("https://router.huggingface.co/fal-ai/fal-ai/flux/schnell", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, width: w, height: h, seed: randomSeed })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Flux failed");

      const fluxUrl = data.images?.[0]?.url || data.image;
      const finalUrl = await uploadImageOrVideo(fluxUrl);

      return res.status(200).json({
        success: true,
        provider: "flux-schnell",
        type: "image",
        prompt,
        url: finalUrl
      });
    }

    // ========================
    // 4. OTHER POLLINATIONS MODELS
    // ========================
    const imageModels = {
      "sd3.5": "sd3.5-medium",
      "nano-banana": "nano-banana-2",
      "seedream": "seedream-5.0",
      "photon": "photon",
      "ideogram": "ideogram-v2"
    };

    if (imageModels[provider]) {
      const modelParam = imageModels[provider];
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?model=${modelParam}&seed=${randomSeed}&width=${w}&height=${h}&nologo=true`;
      const finalUrl = await uploadImageOrVideo(url);
      return res.status(200).json({
        success: true,
        provider,
        type: "image",
        prompt,
        model: modelParam,
        url: finalUrl
      });
    }

    return res.status(400).json({
      success: false,
      error: "Unsupported provider. Use: pollinations, flux, sd3.5, nano-banana, seedream, photon, ideogram, chat"
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
