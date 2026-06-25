export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const { prompt, provider = "pollinations", width = 1024, height = 1024, seed } = req.body;

        if (!prompt) {
            return res.status(400).json({ success: false, error: "Prompt is required" });
        }

        const randomSeed = seed || Math.floor(Math.random() * 999999999);

        // ===========================
        // POLLINATIONS (Fast & Reliable)
        // ===========================
        if (provider.toLowerCase() === "pollinations") {
            const imageUrl = `https://image.pollinations.ai/prompt/\( {encodeURIComponent(prompt)}?seed= \){randomSeed}&nologo=true&width=\( {width}&height= \){height}`;

            const uploaded = await uploadImage(imageUrl);
            return res.status(200).json({
                success: true,
                provider: "pollinations",
                prompt,
                image: uploaded.url || imageUrl,
                upload: uploaded
            });
        }

        // ===========================
        // FLUX SCHNELL (High Quality)
        // ===========================
        if (provider.toLowerCase() === "flux" || provider.toLowerCase() === "flux-schnell") {
            const response = await fetch("https://router.huggingface.co/fal-ai/fal-ai/flux/schnell", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.HF_TOKEN}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    prompt,
                    width: Number(width),
                    height: Number(height),
                    seed: randomSeed,
                    num_images: 1
                })
            });

            const data = await response.json();
            if (!response.ok) {
                return res.status(response.status).json({ success: false, provider: "flux", error: data });
            }

            let fluxImage = data.images?.[0]?.url || data.image || data.output?.[0]?.url || data.url;
            if (!fluxImage) {
                return res.status(500).json({ success: false, provider: "flux", error: "No image returned" });
            }

            const uploaded = await uploadImage(fluxImage);
            return res.status(200).json({
                success: true,
                provider: "flux",
                prompt,
                image: uploaded.url || fluxImage,
                upload: uploaded
            });
        }

        // ===========================
        // NEW: POLLINATIONS FLUX (Alternative endpoint)
        // ===========================
        if (provider.toLowerCase() === "pollinations-flux") {
            const imageUrl = `https://image.pollinations.ai/prompt/\( {encodeURIComponent(prompt)}?model=flux&seed= \){randomSeed}&nologo=true&width=\( {width}&height= \){height}`;

            const uploaded = await uploadImage(imageUrl);
            return res.status(200).json({
                success: true,
                provider: "pollinations-flux",
                prompt,
                image: uploaded.url || imageUrl,
                upload: uploaded
            });
        }

        // ===========================
        // NEW: Stable Diffusion 3.5 (via Pollinations / other free routes)
        // ===========================
        if (provider.toLowerCase() === "sd3.5" || provider.toLowerCase() === "stable-diffusion") {
            const imageUrl = `https://image.pollinations.ai/prompt/\( {encodeURIComponent(prompt)}?model=sd3.5-medium&seed= \){randomSeed}&nologo=true&width=\( {width}&height= \){height}`;

            const uploaded = await uploadImage(imageUrl);
            return res.status(200).json({
                success: true,
                provider: "sd3.5",
                prompt,
                image: uploaded.url || imageUrl,
                upload: uploaded
            });
        }

        return res.status(400).json({
            success: false,
            error: "Unsupported provider. Use: pollinations, pollinations-flux, flux, sd3.5"
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, error: err.message });
    }
}

// Helper to upload image to your temporary storage
async function uploadImage(imageUrl) {
    try {
        const uploadRes = await fetch("https://apis.malvryx.dev/api/uploader/malvryx-temp", {
            method: "POST",
            headers: {
                "X-API-Key": process.env.MALVRYX_API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                url: imageUrl,
                type: "temp",
                expiry: "7d",
                burnAfterRead: "",
                password: ""
            })
        });

        const uploaded = await uploadRes.json();
        return uploaded;
    } catch (e) {
        // Fallback: return original URL if upload fails
        return { url: imageUrl };
    }
}