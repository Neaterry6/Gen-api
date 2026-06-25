```javascript
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const {
      prompt,
      provider = "pollinations"
    } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: "Prompt is required"
      });
    }

    // ===========================
    // POLLINATIONS
    // ===========================

    if (provider.toLowerCase() === "pollinations") {

      const seed = Math.floor(Math.random() * 999999999);

      const imageUrl =
        `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?seed=${seed}&nologo=true`;

      const upload = await fetch(
        "https://apis.malvryx.dev/api/uploader/malvryx-temp",
        {
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
        }
      );

      const uploaded = await upload.json();

      return res.status(200).json({
        success: true,
        provider: "pollinations",
        prompt,
        image:
          uploaded.url ||
          uploaded.link ||
          uploaded.image ||
          uploaded.data?.url ||
          uploaded.data?.link,
        upload: uploaded
      });

    }

    // ===========================
    // FLUX SCHNELL
    // ===========================

    if (provider.toLowerCase() === "flux") {

      const response = await fetch(
        "https://router.huggingface.co/fal-ai/fal-ai/flux/schnell",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.HF_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            prompt
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {

        return res.status(response.status).json({
          success: false,
          provider: "flux",
          error: data
        });

      }

      let fluxImage =
        data.images?.[0]?.url ||
        data.image ||
        data.output?.[0] ||
        data.output ||
        data.url;

      if (!fluxImage) {

        return res.status(500).json({
          success: false,
          provider: "flux",
          error: "Flux did not return an image URL.",
          raw: data
        });

      }

      const upload = await fetch(
        "https://apis.malvryx.dev/api/uploader/malvryx-temp",
        {
          method: "POST",
          headers: {
            "X-API-Key": process.env.MALVRYX_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            url: fluxImage,
            type: "temp",
            expiry: "7d",
            burnAfterRead: "",
            password: ""
          })
        }
      );

      const uploaded = await upload.json();

      return res.status(200).json({
        success: true,
        provider: "flux",
        prompt,
        image:
          uploaded.url ||
          uploaded.link ||
          uploaded.image ||
          uploaded.data?.url ||
          uploaded.data?.link,
        upload: uploaded
      });

    }

    return res.status(400).json({
      success: false,
      error: "Provider must be 'pollinations' or 'flux'"
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      error: err.message
    });

  }
}
```
