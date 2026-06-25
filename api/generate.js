export default async function handler(req, res) {
    if (req.method!== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const {
            prompt,
            provider = "pollinations",
            type = "image",
            width = 1024,
            height = 1024,
            seed,
            image,
            duration = 5,
            modelOverride
        } = req.body;

        if (!prompt) {
            return res.status(400).json({ success: false, error: "Prompt is required" });
        }

        const randomSeed = seed || Math.floor(Math.random() * 999);

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

        if (provider.toLowerCase().includes("pollinations") || provider === "gen") {
            let model = modelOverride || "flux";
            let endpoint = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;

            if (type === "video") {
                endpoint = `https://video.pollinations.ai/prompt/${encodeURIComponent(prompt)}?duration=${duration}&seed=${randomSeed}`;
                model = "seedance" || "kling";
            } else if (type === "chat") {
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
                    response: chatData.response || chatData.text || chatData.content,
                    model: "claude/gemini/deepseek"
                });
            }

            if (type === "image" || type === "video" || type === "edit") {
                if (type === "edit" && image) {
                    endpoint += `&image=${encodeURIComponent(image)}`;
                }
                const finalUrl = await uploadImageOrVideo(endpoint);
                return res.status(200).json({
                    success: true,
                    provider: "pollinations",
                    type,
                    prompt,
                    image: type === "image" || type === "edit"? finalUrl : null,
                    video: type === "video"? finalUrl : null,
                    model
                });
            }
        }

        if (provider.toLowerCase().includes("flux")) {
            const response = await fetch("https://router.huggingface.co/fal-ai/fal-ai/flux/schnell", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.HF_TOKEN}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ prompt, width, height, seed: randomSeed })
            });

            const data = await response.json();
            if (!response.ok) throw new Error("Flux failed");

            const fluxUrl = data.images?.[0]?.url || data.image;
            const finalUrl = await uploadImageOrVideo(fluxUrl);

            return res.status(200).json({
                success: true,
                provider: "flux-schnell",
                type: "image",
                prompt,
                image: finalUrl
            });
        }

        const imageModels = {
            "sd3.5": "sd3.5-medium",
            "nano-banana": "nano-banana-2",
            "seedream": "seedream-5.0",
            "photon": "photon",
            "ideogram": "ideogram-v2"
        };

        if (imageModels[provider.toLowerCase()]) {
            const modelParam = imageModels[provider.toLowerCase()];
            const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?model=${modelParam}&seed=${randomSeed}&width=${width}&height=${height}&nologo=true`;
            const finalUrl = await uploadImageOrVideo(url);
            return res.status(200).json({
                success: true,
                provider,
                type: "image",
                prompt,
                image: finalUrl
            });
        }

        if (type === "video" && provider.toLowerCase().includes("video")) {
            const videoUrl = `https://video.pollinations.ai/prompt/${encodeURIComponent(prompt)}?duration=${Math.min(duration, 10)}`;
            const finalVideo = await uploadImageOrVideo(videoUrl);
            return res.status(200).json({
                success: true,
                provider: "pollinations-video",
                type: "video",
                prompt,
                video: finalVideo
            });
        }

        if (type === "chat") {
            try {
                const chatRes = await fetch("https://gen.pollinations.ai/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        messages: [{ role: "user", content: prompt }],
                        model: "deepseek"
                    })
                });
                const data = await chatRes.json();
                return res.status(200).json({
                    success: true,
                    provider: "pollinations-chat",
                    type: "chat",
                    response: data.response || data.text || JSON.stringify(data)
                });
            } catch (e) {
                return res.status(200).json({
                    success: true,
                    provider: "fallback",
                    type: "chat",
                    response: `Echo: ${prompt}\n\n(Advanced chat models available via Pollinations)`
                });
            }
        }

        return res.status(400).json({
            success: false,
            error: "Unsupported provider/type. Try: pollinations, flux, sd3.5, nano-banana, seedream, video, chat, edit"
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, error: err.message });
    }
}