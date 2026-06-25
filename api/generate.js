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

    // POLLINATIONS
    if (provider.toLowerCase() === "pollinations") {
      const seed = Math.floor(Math.random() * 999999999);

      const imageUrl =
        `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?seed=${seed}&nologo=true`;

      return res.status(200).json({
        success: true,
        provider: "pollinations",
        image: imageUrl,
        prompt
      });
    }

    // HUGGINGFACE FLUX
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

      return res.status(200).json({
        success: true,
        provider: "flux",
        result: data
      });
    }

    return res.status(400).json({
      success: false,
      error: "Provider must be 'pollinations' or 'flux'"
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
