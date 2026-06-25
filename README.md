# Image Generation API

Simple Vercel serverless API for generating images using:

* Pollinations AI (free)
* FLUX Schnell via Hugging Face

## Deployment

1. Clone the repository.
2. Import it into Vercel.
3. Add the environment variable:

HF_TOKEN=your_huggingface_token

4. Deploy.

## Endpoint

### POST /api/generate

Request:

```json
{
  "provider": "pollinations",
  "prompt": "anime girl with blue hair"
}
```

or

```json
{
  "provider": "flux",
  "prompt": "anime girl with blue hair"
}
```

## Response

```json
{
  "success": true,
  "provider": "pollinations",
  "image": "https://..."
}
```

or

```json
{
  "success": true,
  "provider": "flux",
  "result": {}
}
```

## Supported Providers

| Provider     | Description                   |
| ------------ | ----------------------------- |
| pollinations | Free image generation         |
| flux         | FLUX Schnell via Hugging Face |

## License

MIT
