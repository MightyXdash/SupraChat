
<h1 align="center">SupraChat</h1>



<img width="3440" height="1080" alt="SupraLabs_theme_Artwork_redesign" src="https://github.com/user-attachments/assets/b04de0a0-714b-4c8f-956a-9559a66a1e75" /><div align="center">



ㅤ

<p align="center">
  <a href="https://huggingface.co/SupraLabs/Supra-1.5-50M-Base-exp"><img src="https://img.shields.io/badge/🤗%20Supra--50M-Base-FFD43B?labelColor=3A3A3A&color=FFD43B" alt="Supra-50M Base"></a>
  <a href="https://huggingface.co/SupraLabs/Supra-1.5-50M-Instruct-exp"><img src="https://img.shields.io/badge/🤗%20Supra--50M-Instruct-7C3AED?labelColor=3A3A3A&color=7C3AED" alt="Supra-50M Instruct"></a>
  <a href="https://huggingface.co/SupraLabs/Supra-50M-Reasoning"><img src="https://img.shields.io/badge/🤗%20Supra--50M-Reasoning-06B6D4?labelColor=3A3A3A&color=06B6D4" alt="Supra-50M Reasoning"></a>
</p>

<p align="center">
  <a href="https://huggingface.co/spaces/SupraLabs/Supra1.5-50M-Instruct-Demo"><img src="https://img.shields.io/badge/💬%20Demo-Instruct-10B981?labelColor=3A3A3A&color=10B981" alt="Instruct Demo"></a>
  <a href="https://huggingface.co/spaces/SupraLabs/Supra-50M-Reasoning-Demo"><img src="https://img.shields.io/badge/🧪%20Demo-Reasoning-00A8E8?labelColor=3A3A3A&color=00A8E8" alt="Reasoning Demo"></a>
  <a href="https://huggingface.co/spaces/SupraLabs/Blog"><img src="https://img.shields.io/badge/📰%20SupraLabs-Blog-F97316?labelColor=3A3A3A&color=F97316" alt="SupraLabs Blog"></a>
  <a href="https://huggingface.co/spaces/SupraLabs/Research"><img src="https://img.shields.io/badge/🔬%20SupraLabs-Research-E11D48?labelColor=3A3A3A&color=E11D48" alt="SupraLabs Research"></a>
</p>

ㅤ

SupraChat is a professional, cross-platform client application engineered for seamless local SupraLabs model execution. It uses a packaged `llama.cpp` runtime for fast, resource-conscious desktop inference.

## Local runtime

After cloning, install dependencies and verify the local runtime contract:

```bash
npm install
npm run models:download
npm run runtime:check
```

Cross-platform packages require a matching `llama-server` binary in
`resources/llama.cpp/<platform>-<arch>/`. Before releasing builds for macOS,
Windows, or Linux, run:

```bash
npm run runtime:check:all
```

The Electron app runs the Node backend inside Electron's bundled Node runtime,
so packaged builds do not require a separate system Node installation.


_placeholder image_

