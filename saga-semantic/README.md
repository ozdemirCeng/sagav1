---
title: Saga AI Search
emoji: 🎬
colorFrom: purple
colorTo: yellow
sdk: docker
pinned: false
license: mit
---

# Saga AI Search Service

Film, dizi ve kitap için semantic search servisi.

## API Endpoints

### GET /
Sağlık kontrolü

### POST /index
İçerikleri indexle

```json
{
  "contents": [
    {
      "id": 1,
      "baslik": "Inception",
      "tur": "film",
      "aciklama": "Rüyalar içinde rüyalar...",
      "yil": 2010
    }
  ]
}
```

### POST /search
Semantic arama yap

```json
{
  "query": "rüya içinde rüya olan bir film",
  "limit": 5,
  "tur": "film"
}
```

## Teknolojiler

- **Embedding**: all-MiniLM-L6-v2 (384 boyut)
- **Vector DB**: FAISS
- **API**: FastAPI
- **UI**: Gradio
