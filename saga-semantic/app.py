"""
Saga AI Microservice
HuggingFace Spaces üzerinde çalışacak semantic search + LLM servisi
"""

import os
import json
import numpy as np
import httpx
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import faiss
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline
import torch

# FastAPI app
app = FastAPI(
    title="Saga AI Service",
    description="Film ve kitap için semantic search + LLM servisi",
    version="5.0.0"
)

# CORS ayarları
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Production'da kısıtla
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global değişkenler
model: SentenceTransformer = None
index: faiss.IndexFlatIP = None
content_data: List[dict] = []

# Groq API - Ücretsiz, çok hızlı, çok akıllı!
# llama-3.3-70b-versatile: 30 req/min, 1K req/day, 12K tokens/min
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = "llama-3.3-70b-versatile"  # En akıllı model!
USE_GROQ = bool(GROQ_API_KEY)

# Lokal model (Groq yoksa fallback)
LLM_MODEL_NAME = "Qwen/Qwen2.5-3B-Instruct"
llm_tokenizer = None
llm_model = None
llm_pipe = None

# Pydantic modelleri
class SearchRequest(BaseModel):
    query: str
    limit: int = 5
    tur: Optional[str] = None  # film, dizi, kitap

class ContentItem(BaseModel):
    id: int
    baslik: str
    tur: str
    aciklama: str
    yil: Optional[int] = None
    posterUrl: Optional[str] = None
    puan: Optional[float] = None

class SearchResult(BaseModel):
    id: int
    baslik: str
    tur: str
    aciklama: str
    yil: Optional[int] = None
    posterUrl: Optional[str] = None
    puan: Optional[float] = None
    score: float
    neden: str  # Neden bu sonuç döndü

class SearchResponse(BaseModel):
    results: List[SearchResult]
    query: str
    total: int

class IndexRequest(BaseModel):
    contents: List[ContentItem]

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    index_size: int
    llm_loaded: bool


# LLM için yeni modeller
class GenerateRequest(BaseModel):
    prompt: str
    max_tokens: int = 300
    temperature: float = 0.7
    system_prompt: Optional[str] = None


class GenerateResponse(BaseModel):
    text: str
    tokens_used: int


class RecommendRequest(BaseModel):
    query: str
    user_history: Optional[List[str]] = None  # Kullanıcının izlediği/okuduğu şeyler
    tur: Optional[str] = None
    limit: int = 5


class YearlySummaryRequest(BaseModel):
    kullanici_adi: str
    yil: int
    toplam_icerik: int
    film_sayisi: int
    dizi_sayisi: int
    kitap_sayisi: int
    toplam_dakika: int
    toplam_sayfa: int
    en_cok_izlenen_turler: List[str]
    en_yuksek_puanlilar: List[str]
    ortalama_puan: float


class YearlySummaryResponse(BaseModel):
    narrative: str
    title: str


# Film/Dizi/Kitap tanımlama için yeni modeller
class IdentifyRequest(BaseModel):
    description: str  # Kullanıcının tanımı: "ellerinden pençe çıkan adam"
    tur: Optional[str] = None  # film, dizi, kitap


class IdentifyResponse(BaseModel):
    found: bool
    title: str  # Tahmin edilen başlık: "Wolverine" veya "X-Men"
    title_en: Optional[str] = None  # İngilizce başlık (arama için)
    tur: str  # film, dizi, kitap
    year: Optional[int] = None
    explanation: str  # Neden bu sonuç: "Wolverine karakteri X-Men filmlerinde..."
    confidence: float  # Güven skoru 0-1
    search_query: str  # TMDB/Google Books araması için önerilen sorgu


# ===== YENİ: Genel AI Chat Modelleri =====
class ChatMessage(BaseModel):
    role: str  # "user", "assistant", "system"
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]  # Sohbet geçmişi
    context: Optional[str] = None  # Opsiyonel: sayfa/içerik konteksti
    max_tokens: int = 500

class ChatResponse(BaseModel):
    message: str
    suggestions: Optional[List[str]] = None  # Önerilen takip soruları

class ContentQuestionRequest(BaseModel):
    content_id: Optional[int] = None
    content_title: str
    content_type: str  # film, dizi, kitap
    content_description: Optional[str] = None
    question: str  # Kullanıcının sorusu

class ContentQuestionResponse(BaseModel):
    answer: str
    related_questions: Optional[List[str]] = None

class ChatHistoryItem(BaseModel):
    role: str  # "user" veya "assistant"
    content: str

class AssistantRequest(BaseModel):
    query: str  # Kullanıcının sorduğu şey
    current_page: Optional[str] = None  # Kullanıcının bulunduğu sayfa
    user_context: Optional[dict] = None  # Kullanıcı bilgisi (izleme geçmişi vs.)
    chat_history: Optional[List[ChatHistoryItem]] = None  # Önceki sohbet mesajları

class AssistantResponse(BaseModel):
    message: str
    action: Optional[str] = None  # Yapılacak aksiyon: "navigate", "search", "recommend", "info"
    action_data: Optional[dict] = None  # Aksiyon için ek veri
    suggestions: Optional[List[str]] = None


def load_model():
    """Embedding modelini yükle"""
    global model
    if model is None:
        print("🔄 Model yükleniyor: all-MiniLM-L6-v2")
        model = SentenceTransformer('all-MiniLM-L6-v2')
        print("✅ Model yüklendi!")
    return model


def load_llm():
    """Lokal LLM modelini yükle"""
    global llm_tokenizer, llm_model, llm_pipe
    
    if USE_GROQ:
        print("✅ Groq API kullanılacak (Llama 3.1 70B)")
        return True
    
    if llm_pipe is None:
        print(f"🔄 LLM yükleniyor: {LLM_MODEL_NAME}")
        try:
            llm_tokenizer = AutoTokenizer.from_pretrained(LLM_MODEL_NAME)
            llm_model = AutoModelForCausalLM.from_pretrained(
                LLM_MODEL_NAME,
                torch_dtype=torch.float32,
                device_map="cpu",
                low_cpu_mem_usage=True
            )
            llm_pipe = pipeline(
                "text-generation",
                model=llm_model,
                tokenizer=llm_tokenizer,
                device="cpu"
            )
            print("✅ LLM yüklendi!")
        except Exception as e:
            print(f"❌ LLM yüklenemedi: {e}")
            llm_pipe = None
    
    return llm_pipe


async def call_groq_api(messages: list, max_tokens: int = 300) -> str:
    """Groq API ile yanıt üret - ÇOK HIZLI!"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                json={
                    "model": GROQ_MODEL,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": 0.7
                },
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                return result["choices"][0]["message"]["content"]
            else:
                print(f"❌ Groq API hatası: {response.status_code} - {response.text}")
                return None
    except Exception as e:
        print(f"❌ Groq API çağrı hatası: {e}")
        return None


async def call_local_llm(messages: list, max_tokens: int = 300) -> str:
    """LLM ile yanıt üret - Groq varsa onu kullan, yoksa lokal"""
    
    if USE_GROQ:
        return await call_groq_api(messages, max_tokens)
    
    pipe = load_llm()
    if pipe is None:
        return None
    
    try:
        response = pipe(
            messages,
            max_new_tokens=max_tokens,
            temperature=0.7,
            do_sample=True,
            pad_token_id=llm_tokenizer.eos_token_id
        )
        
        if response and len(response) > 0:
            generated = response[0].get("generated_text", [])
            if isinstance(generated, list) and len(generated) > 0:
                for msg in reversed(generated):
                    if msg.get("role") == "assistant":
                        return msg.get("content", "")
            elif isinstance(generated, str):
                return generated
        
        return None
        
    except Exception as e:
        print(f"❌ LLM çağrı hatası: {e}")
        return None


# Geriye uyumluluk için eski fonksiyon adları
async def call_hf_serverless_api(messages: list, max_tokens: int = 300) -> str:
    return await call_local_llm(messages, max_tokens)

async def call_hf_router_api(messages: list, max_tokens: int = 300) -> str:
    return await call_local_llm(messages, max_tokens)


async def call_hf_inference_api(prompt: str, max_tokens: int = 300, system_prompt: str = None) -> str:
    """LLM çağır"""
    
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    
    return await call_local_llm(messages, max_tokens)


def extract_json(text: str) -> Optional[str]:
    """Metinden JSON objesini çıkar (iç içe {} destekli)"""
    import re
    
    if not text:
        return None
    
    # Önce ```json bloğu ara
    code_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
    if code_match:
        return code_match.group(1)
    
    # Sonra normal JSON bloğu ara - brace counting ile
    start = text.find('{')
    if start == -1:
        return None
    
    depth = 0
    for i, char in enumerate(text[start:], start):
        if char == '{':
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0:
                return text[start:i+1]
    return None


def parse_assistant_response(text: str) -> dict:
    """Asistan yanıtını parse et - JSON veya düz metin"""
    if not text:
        return {"message": "Yanıt alınamadı", "action": None, "action_data": None, "suggestions": None}
    
    # JSON parse dene
    json_str = extract_json(text)
    if json_str:
        try:
            parsed = json.loads(json_str)
            # message içinde de JSON string varsa tekrar parse et
            if isinstance(parsed.get("message"), str) and parsed["message"].strip().startswith("{"):
                inner_json = extract_json(parsed["message"])
                if inner_json:
                    try:
                        inner_parsed = json.loads(inner_json)
                        # İç JSON'ı ana yanıtla birleştir
                        return {
                            "message": inner_parsed.get("message", parsed["message"]),
                            "action": inner_parsed.get("action") or parsed.get("action"),
                            "action_data": inner_parsed.get("action_data") or parsed.get("action_data"),
                            "suggestions": inner_parsed.get("suggestions") or parsed.get("suggestions")
                        }
                    except:
                        pass
            return parsed
        except json.JSONDecodeError:
            pass
    
    # JSON yoksa düz metin olarak işle
    return {"message": text.strip(), "action": None, "action_data": None, "suggestions": None}


def create_search_text(item: dict) -> str:
    """İçerik için aranabilir metin oluştur"""
    parts = [
        item.get('baslik', ''),
        item.get('aciklama', ''),
        item.get('tur', ''),
    ]
    if item.get('yil'):
        parts.append(str(item['yil']))
    return ' '.join(filter(None, parts))


def generate_reason(query: str, item: dict, score: float) -> str:
    """Sonuç için açıklama oluştur"""
    tur_map = {
        'film': '🎬 Film',
        'dizi': '📺 Dizi', 
        'kitap': '📚 Kitap'
    }
    tur_emoji = tur_map.get(item.get('tur', '').lower(), '🎭')
    
    if score > 0.7:
        return f"{tur_emoji} Aradığınızla çok benzer içerik"
    elif score > 0.5:
        return f"{tur_emoji} İlgili içerik bulundu"
    else:
        return f"{tur_emoji} Benzer tema"


@app.on_event("startup")
async def startup_event():
    """Uygulama başlarken modeli yükle"""
    load_model()
    
    # Eğer önceden kaydedilmiş index varsa yükle
    if os.path.exists("faiss_index.bin") and os.path.exists("content_data.json"):
        load_index_from_disk()


def load_index_from_disk():
    """Disk'ten index ve veri yükle"""
    global index, content_data
    try:
        index = faiss.read_index("faiss_index.bin")
        with open("content_data.json", "r", encoding="utf-8") as f:
            content_data = json.load(f)
        print(f"✅ Index yüklendi: {len(content_data)} içerik")
    except Exception as e:
        print(f"⚠️ Index yüklenemedi: {e}")


def save_index_to_disk():
    """Index ve veriyi disk'e kaydet"""
    global index, content_data
    try:
        faiss.write_index(index, "faiss_index.bin")
        with open("content_data.json", "w", encoding="utf-8") as f:
            json.dump(content_data, f, ensure_ascii=False)
        print(f"✅ Index kaydedildi: {len(content_data)} içerik")
    except Exception as e:
        print(f"⚠️ Index kaydedilemedi: {e}")


@app.get("/", response_model=HealthResponse)
async def health_check():
    """Sağlık kontrolü"""
    return HealthResponse(
        status="healthy",
        model_loaded=model is not None,
        index_size=len(content_data),
        llm_loaded=True  # HuggingFace Inference API kullanıyoruz, her zaman hazır
    )


@app.post("/index", response_model=dict)
async def index_contents(request: IndexRequest):
    """İçerikleri indexle (embedding oluştur)"""
    global index, content_data
    
    if not request.contents:
        raise HTTPException(status_code=400, detail="İçerik listesi boş")
    
    load_model()
    
    # İçerikleri hazırla
    content_data = [item.dict() for item in request.contents]
    texts = [create_search_text(item) for item in content_data]
    
    print(f"🔄 {len(texts)} içerik için embedding oluşturuluyor...")
    
    # Embedding oluştur
    embeddings = model.encode(texts, convert_to_numpy=True, show_progress_bar=True)
    
    # Normalize et (cosine similarity için)
    faiss.normalize_L2(embeddings)
    
    # FAISS index oluştur
    dimension = embeddings.shape[1]
    index = faiss.IndexFlatIP(dimension)  # Inner Product = Cosine Similarity (normalized için)
    index.add(embeddings)
    
    # Disk'e kaydet
    save_index_to_disk()
    
    print(f"✅ Index oluşturuldu: {index.ntotal} içerik")
    
    return {
        "success": True,
        "indexed_count": len(content_data),
        "dimension": dimension
    }


@app.post("/search", response_model=SearchResponse)
async def semantic_search(request: SearchRequest):
    """Semantic search yap"""
    global index, content_data
    
    if index is None or len(content_data) == 0:
        raise HTTPException(status_code=400, detail="Index henüz oluşturulmamış. Önce /index endpoint'ini çağırın.")
    
    load_model()
    
    # Query embedding
    query_embedding = model.encode([request.query], convert_to_numpy=True)
    faiss.normalize_L2(query_embedding)
    
    # Arama yap
    k = min(request.limit * 2, len(content_data))  # Filtreleme için fazla al
    scores, indices = index.search(query_embedding, k)
    
    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx == -1:
            continue
            
        item = content_data[idx]
        
        # Tür filtresi
        if request.tur and item.get('tur', '').lower() != request.tur.lower():
            continue
        
        results.append(SearchResult(
            id=item.get('id', idx),
            baslik=item.get('baslik', ''),
            tur=item.get('tur', ''),
            aciklama=item.get('aciklama', '')[:200] + '...' if len(item.get('aciklama', '')) > 200 else item.get('aciklama', ''),
            yil=item.get('yil'),
            posterUrl=item.get('posterUrl'),
            puan=item.get('puan'),
            score=float(score),
            neden=generate_reason(request.query, item, float(score))
        ))
        
        if len(results) >= request.limit:
            break
    
    return SearchResponse(
        results=results,
        query=request.query,
        total=len(results)
    )


@app.post("/embed")
async def get_embedding(text: str):
    """Tek bir metin için embedding döndür (debug için)"""
    load_model()
    embedding = model.encode([text], convert_to_numpy=True)
    return {"embedding": embedding[0].tolist(), "dimension": len(embedding[0])}


@app.post("/generate", response_model=GenerateResponse)
async def generate_text(request: GenerateRequest):
    """LLM ile metin üret"""
    pipe = load_llm()
    
    if pipe is None:
        raise HTTPException(status_code=503, detail="LLM henüz yüklenmedi, lütfen bekleyin")
    
    try:
        # Phi-3 chat format
        messages = []
        if request.system_prompt:
            messages.append({"role": "system", "content": request.system_prompt})
        messages.append({"role": "user", "content": request.prompt})
        
        result = pipe(
            messages,
            max_new_tokens=request.max_tokens,
            temperature=request.temperature,
            do_sample=True,
            pad_token_id=llm_tokenizer.eos_token_id
        )
        
        generated_text = result[0]["generated_text"]
        
        return GenerateResponse(
            text=generated_text,
            tokens_used=len(llm_tokenizer.encode(generated_text))
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Üretim hatası: {str(e)}")


@app.post("/recommend")
async def smart_recommend(request: RecommendRequest):
    """Semantic search + LLM ile akıllı öneri"""
    global index, content_data
    
    if index is None or len(content_data) == 0:
        raise HTTPException(status_code=400, detail="Index henüz oluşturulmamış")
    
    load_model()
    pipe = load_llm()
    
    # Önce semantic search ile benzer içerikleri bul
    query_embedding = model.encode([request.query], convert_to_numpy=True)
    faiss.normalize_L2(query_embedding)
    
    k = min(request.limit * 3, len(content_data))
    scores, indices = index.search(query_embedding, k)
    
    candidates = []
    for score, idx in zip(scores[0], indices[0]):
        if idx == -1:
            continue
        item = content_data[idx]
        if request.tur and item.get('tur', '').lower() != request.tur.lower():
            continue
        candidates.append({
            **item,
            "score": float(score)
        })
        if len(candidates) >= request.limit:
            break
    
    # LLM ile açıklama ekle (opsiyonel, LLM yoksa sadece search sonucu döner)
    if pipe and candidates:
        for item in candidates:
            item["neden"] = f"'{request.query}' aramanıza benzer içerik"
    else:
        for item in candidates:
            item["neden"] = generate_reason(request.query, item, item["score"])
    
    return {
        "query": request.query,
        "results": candidates,
        "total": len(candidates)
    }


@app.post("/yearly-summary", response_model=YearlySummaryResponse)
async def generate_yearly_summary(request: YearlySummaryRequest):
    """Yıllık özet için Spotify Wrapped tarzı anlatı üret - Groq API ile"""
    
    try:
        # Prompt oluştur
        prompt = f"""Sen bir medya asistanısın. Kullanıcının yıllık izleme/okuma istatistiklerini Spotify Wrapped tarzında, eğlenceli ve samimi bir dille anlat. Türkçe yaz.

Kullanıcı: {request.kullanici_adi}
Yıl: {request.yil}

İstatistikler:
- Toplam içerik: {request.toplam_icerik}
- Film: {request.film_sayisi}
- Dizi: {request.dizi_sayisi}
- Kitap: {request.kitap_sayisi}
- Toplam izleme süresi: {request.toplam_dakika} dakika ({request.toplam_dakika // 60} saat)
- Okunan sayfa: {request.toplam_sayfa}
- En sevilen türler: {', '.join(request.en_cok_izlenen_turler[:3]) if request.en_cok_izlenen_turler else 'Belirtilmemiş'}
- En yüksek puanlananlar: {', '.join(request.en_yuksek_puanlilar[:3]) if request.en_yuksek_puanlilar else 'Belirtilmemiş'}
- Ortalama puan: {request.ortalama_puan}

Kısa (4-5 cümle), eğlenceli, samimi ve kişisel bir özet yaz. 
- Kullanıcının izleme alışkanlıklarını analiz et
- Esprili ve sıcak bir dil kullan
- Emoji kullan 🎬📺📚
- Kullanıcıyı özel hissettir"""

        messages = [
            {"role": "system", "content": "Sen eğlenceli, samimi ve yaratıcı bir medya asistanısın. Spotify Wrapped tarzında kişiselleştirilmiş özetler yazıyorsun."},
            {"role": "user", "content": prompt}
        ]
        
        # Groq API veya lokal LLM kullan
        narrative = await call_local_llm(messages, max_tokens=400)
        
        if not narrative:
            # API başarısız olursa fallback kullan
            return YearlySummaryResponse(
                title=f"🎬 {request.kullanici_adi}'ın {request.yil} Yılı",
                narrative=generate_fallback_narrative(request)
            )
        
        # Başlık oluştur
        title = f"🎬 {request.kullanici_adi}'ın {request.yil} Macerası"
        
        return YearlySummaryResponse(
            title=title,
            narrative=narrative
        )
    except Exception as e:
        print(f"LLM hatası: {e}")
        return YearlySummaryResponse(
            title=f"🎬 {request.kullanici_adi}'ın {request.yil} Yılı",
            narrative=generate_fallback_narrative(request)
        )


def generate_fallback_narrative(request: YearlySummaryRequest) -> str:
    """LLM olmadan basit anlatı oluştur"""
    saat = request.toplam_dakika // 60
    
    parts = [f"Bu yıl tam {request.toplam_icerik} içerik keşfettin! 🎉"]
    
    if request.film_sayisi > request.dizi_sayisi:
        parts.append(f"{request.film_sayisi} film ile sinema tutkunu olduğun belli.")
    elif request.dizi_sayisi > 0:
        parts.append(f"{request.dizi_sayisi} dizi bitirdin, maratoncusun!")
    
    if request.kitap_sayisi > 0:
        parts.append(f"{request.toplam_sayfa} sayfa okuyarak kitap kurtlarına katıldın. 📚")
    
    if saat > 100:
        parts.append(f"{saat} saatlik izleme süresiyle gerçek bir içerik gurmesisin!")
    
    if request.en_cok_izlenen_turler:
        parts.append(f"En sevdiğin tür: {request.en_cok_izlenen_turler[0]}.")
    
    return " ".join(parts)


# Bilinen popüler içerikler için pattern matching
KNOWN_CONTENT_PATTERNS = [
    # Film patterns
    {
        "patterns": ["pençe", "pence", "wolverine", "adamantium", "x-men", "xmen", "logan"],
        "title": "X-Men",
        "title_en": "X-Men",
        "tur": "film",
        "year": 2000,
        "explanation": "Wolverine karakteri ellerinden çıkan adamantium pençeleriyle tanınır"
    },
    {
        "patterns": ["yeşil dev", "kızınca yeşil", "hulk", "bruce banner", "gamma", "öfkelenince"],
        "title": "Hulk",
        "title_en": "The Incredible Hulk",
        "tur": "film",
        "year": 2008,
        "explanation": "Bruce Banner öfkelendiğinde yeşil bir deve dönüşür"
    },
    {
        "patterns": ["örümcek", "spider", "peter parker", "ağ atar", "duvar tırman"],
        "title": "Örümcek Adam",
        "title_en": "Spider-Man",
        "tur": "film",
        "year": 2002,
        "explanation": "Peter Parker örümcek tarafından ısırılarak süper güçler kazanır"
    },
    {
        "patterns": ["demir adam", "iron man", "tony stark", "zırh", "arc reactor"],
        "title": "Demir Adam",
        "title_en": "Iron Man",
        "tur": "film",
        "year": 2008,
        "explanation": "Tony Stark'ın yarattığı teknolojik zırh"
    },
    {
        "patterns": ["yarasa", "batman", "gotham", "bruce wayne", "kara şövalye"],
        "title": "Batman",
        "title_en": "The Dark Knight",
        "tur": "film",
        "year": 2008,
        "explanation": "Bruce Wayne gece yarasa kostümüyle suçla savaşır"
    },
    {
        "patterns": ["joker", "palyaço", "neden bu kadar ciddi", "why so serious"],
        "title": "Kara Şövalye",
        "title_en": "The Dark Knight",
        "tur": "film",
        "year": 2008,
        "explanation": "Joker'in 'Why so serious?' repliğiyle ünlü film"
    },
    {
        "patterns": ["thanos", "eldiven", "parmak şıklat", "infinity", "yarısı yok"],
        "title": "Avengers: Sonsuzluk Savaşı",
        "title_en": "Avengers: Infinity War",
        "tur": "film",
        "year": 2018,
        "explanation": "Thanos Sonsuzluk Eldiveni ile evrenin yarısını yok eder"
    },
    {
        "patterns": ["matrix", "kırmızı hap", "neo", "morpheus", "gerçeklik simülasyon"],
        "title": "Matrix",
        "title_en": "The Matrix",
        "tur": "film",
        "year": 1999,
        "explanation": "Neo gerçekliğin bir simülasyon olduğunu keşfeder"
    },
    {
        "patterns": ["yüzük", "frodo", "mordor", "gandalf", "hobbit", "sauron", "orta dünya"],
        "title": "Yüzüklerin Efendisi",
        "title_en": "The Lord of the Rings",
        "tur": "film",
        "year": 2001,
        "explanation": "Frodo Tek Yüzük'ü yok etmek için Mordor'a yolculuk eder"
    },
    {
        "patterns": ["hogwarts", "harry potter", "büyücü", "voldemort", "asası", "quidditch"],
        "title": "Harry Potter",
        "title_en": "Harry Potter",
        "tur": "film",
        "year": 2001,
        "explanation": "Büyücü çocuk Harry Potter'ın Hogwarts maceraları"
    },
    {
        "patterns": ["titanic", "gemi batıyor", "buz dağı", "jack", "rose", "kalbim devam"],
        "title": "Titanik",
        "title_en": "Titanic",
        "tur": "film",
        "year": 1997,
        "explanation": "Jack ve Rose'un trajik aşk hikayesi"
    },
    {
        "patterns": ["inception", "rüya içinde rüya", "totem", "rüyaya gir"],
        "title": "Başlangıç",
        "title_en": "Inception",
        "tur": "film",
        "year": 2010,
        "explanation": "Rüyaların içine girip fikir çalma/yerleştirme"
    },
    {
        "patterns": ["interstellar", "kara delik", "uzay zaman", "murph", "5. boyut"],
        "title": "Yıldızlararası",
        "title_en": "Interstellar",
        "tur": "film",
        "year": 2014,
        "explanation": "İnsanlığı kurtarmak için uzay yolculuğu"
    },
    {
        "patterns": ["fight club", "dövüş kulübü", "tyler durden", "ilk kural konuşma"],
        "title": "Dövüş Kulübü",
        "title_en": "Fight Club",
        "tur": "film",
        "year": 1999,
        "explanation": "Tyler Durden'ın kurduğu yeraltı dövüş kulübü"
    },
    {
        "patterns": ["forrest gump", "koş forrest", "çikolata kutusu", "hayat kutu"],
        "title": "Forrest Gump",
        "title_en": "Forrest Gump",
        "tur": "film",
        "year": 1994,
        "explanation": "Forrest Gump'ın olağanüstü hayat hikayesi"
    },
    # Dizi patterns
    {
        "patterns": ["breaking bad", "heisenberg", "meth", "walter white", "kimya öğretmen", "kimya ogretmen", "uyuşturucu üret", "uyusturucu uret", "blue meth"],
        "title": "Breaking Bad",
        "title_en": "Breaking Bad",
        "tur": "dizi",
        "year": 2008,
        "explanation": "Kimya öğretmeni uyuşturucu imparatorluğu kurar"
    },
    {
        "patterns": ["game of thrones", "taht oyunları", "westeros", "ejderha", "kış geliyor"],
        "title": "Taht Oyunları",
        "title_en": "Game of Thrones",
        "tur": "dizi",
        "year": 2011,
        "explanation": "Demir Taht için krallıklar savaşı"
    },
    {
        "patterns": ["stranger things", "demogorgon", "upside down", "eleven", "80ler"],
        "title": "Stranger Things",
        "title_en": "Stranger Things",
        "tur": "dizi",
        "year": 2016,
        "explanation": "Hawkins kasabasının paranormal olayları"
    },
    {
        "patterns": ["friends", "central perk", "ross rachel", "how you doin"],
        "title": "Friends",
        "title_en": "Friends",
        "tur": "dizi",
        "year": 1994,
        "explanation": "New York'ta 6 arkadaşın hikayesi"
    },
    {
        "patterns": ["office", "michael scott", "dunder mifflin", "that's what she said"],
        "title": "Ofis",
        "title_en": "The Office",
        "tur": "dizi",
        "year": 2005,
        "explanation": "Kağıt şirketindeki ofis çalışanlarının hayatı"
    },
    {
        "patterns": ["money heist", "la casa de papel", "professor", "bella ciao", "soygun"],
        "title": "La Casa de Papel",
        "title_en": "Money Heist",
        "tur": "dizi",
        "year": 2017,
        "explanation": "Darphane soygunu planı"
    },
    # Kitap patterns
    {
        "patterns": ["1984", "büyük birader", "big brother", "orwell"],
        "title": "1984",
        "title_en": "1984",
        "tur": "kitap",
        "year": 1949,
        "explanation": "George Orwell'ın distopik romanı"
    },
    {
        "patterns": ["suç ve ceza", "raskolnikov", "dostoyevski", "cinayet vicdan"],
        "title": "Suç ve Ceza",
        "title_en": "Crime and Punishment",
        "tur": "kitap",
        "year": 1866,
        "explanation": "Raskolnikov'un cinayet ve vicdan azabı hikayesi"
    },
]


def match_known_content(description: str) -> Optional[IdentifyResponse]:
    """Bilinen içerik kalıplarını eşleştir"""
    desc_lower = description.lower()
    
    for content in KNOWN_CONTENT_PATTERNS:
        for pattern in content["patterns"]:
            if pattern.lower() in desc_lower:
                return IdentifyResponse(
                    found=True,
                    title=content["title"],
                    title_en=content["title_en"],
                    tur=content["tur"],
                    year=content["year"],
                    explanation=content["explanation"],
                    confidence=0.95,
                    search_query=content["title_en"]
                )
    
    return None


@app.post("/identify", response_model=IdentifyResponse)
async def identify_content(request: IdentifyRequest):
    """
    Kullanıcının tanımından veya sorusundan film/dizi/kitap adı döndür.
    - Tanım: "ellerinden pençe çıkan adam" -> "X-Men"
    - Soru: "en popüler dizi" -> "Game of Thrones" gibi popüler bir dizi öner
    """
    
    # Önce bilinen popüler içerikler için pattern matching dene
    known_content = match_known_content(request.description)
    if known_content:
        return known_content
    
    # HuggingFace Inference API ile LLM çağır
    try:
        tur_hint = ""
        if request.tur:
            tur_map = {"film": "film", "dizi": "TV dizisi", "kitap": "kitap"}
            tur_hint = f"Bu bir {tur_map.get(request.tur, request.tur)} olmalı."
        
        # Kimi-K2 için OpenAI uyumlu format
        system_prompt = """Sen bir film, dizi ve kitap uzmanısın. 

GÖREV: Kullanıcının isteğine göre GERÇEK, VAR OLAN bir içerik adı döndür!

KURALLAR:
1. Her zaman GERÇEK bir film/dizi/kitap adı ver (örn: "Breaking Bad", "Harry Potter", "1984")
2. ASLA genel ifadeler kullanma (örn: "En Popüler Dizi" YANLIŞ, "Game of Thrones" DOĞRU)
3. ASLA kategorik isimler verme (örn: "Best-Selling Book" YANLIŞ, "Don Kişot" DOĞRU)
4. Kullanıcı "öneri" istiyorsa popüler ve kaliteli bir içerik öner

SADECE JSON formatında cevap ver, başka hiçbir şey yazma."""
        
        user_prompt = f"""Kullanıcının metni: "{request.description}"
{tur_hint}

DOĞRU ÖRNEKLER (GERÇEK İÇERİK ADLARI):
- "en popüler dizi" -> title: "Breaking Bad"
- "iyi bir film öner" -> title: "Esaretin Bedeli", title_en: "The Shawshank Redemption"
- "kitap öner" -> title: "Suç ve Ceza", title_en: "Crime and Punishment"
- "korku filmi" -> title: "Şeytan", title_en: "The Exorcist"
- "bilim kurgu dizisi" -> title: "Black Mirror"
- "romantik kitap" -> title: "Aşk", title_en: "Love"
- "komedi filmi" -> title: "Maskeli Beşler"

YANLIŞ ÖRNEKLER (BUNLARI YAPMA):
- title: "En Popüler Dizi" ❌
- title: "Best-Selling Book" ❌
- title: "İyi Film" ❌

JSON formatında cevap ver:
{{
    "found": true,
    "title": "GERÇEK içerik adı (Türkçe)",
    "title_en": "GERÇEK içerik adı (İngilizce)",
    "tur": "film/dizi/kitap",
    "year": yıl veya null,
    "explanation": "Kısa açıklama",
    "confidence": 0.8
}}"""

        response_text = await call_hf_inference_api(user_prompt, max_tokens=250, system_prompt=system_prompt)
        
        if not response_text:
            # API çalışmadı, pattern matching sonucunu döndür
            return IdentifyResponse(
                found=False,
                title="",
                title_en=None,
                tur=request.tur or "film",
                year=None,
                explanation="LLM API'ye ulaşılamadı",
                confidence=0.0,
                search_query=request.description
            )
        
        print(f"LLM yanıtı: {response_text}")
        
        # JSON parse et
        import re
        json_match = re.search(r'\{[^{}]*\}', response_text, re.DOTALL)
        
        if json_match:
            parsed = json.loads(json_match.group())
            
            title = parsed.get("title", "")
            title_en = parsed.get("title_en", title)
            tur = parsed.get("tur", "film")
            confidence = float(parsed.get("confidence", 0.7))
            
            # Genel/sahte isim kontrolü - bunlar gerçek içerik değil
            fake_patterns = [
                "en popüler", "en iyi", "best", "most", "top", "popular",
                "öneri", "tavsiye", "recommend", "selling", "çok okunan",
                "iyi film", "iyi dizi", "iyi kitap", "good", "great",
                "excellent", "amazing", "awesome", "wonderful", "perfect",
                "bir film", "bir dizi", "bir kitap", "a book", "a movie",
                "an excellent", "a great", "a good", "the best"
            ]
            title_lower = title.lower() if title else ""
            title_en_lower = title_en.lower() if title_en else ""
            is_fake_title = (
                any(p in title_lower for p in fake_patterns) or 
                any(p in title_en_lower for p in fake_patterns) or 
                len(title) < 3 or
                title_lower in ["film", "dizi", "kitap", "book", "movie", "series", "show"]
            )
            
            # Başlık yoksa veya sahte isimse fallback öner
            if not title or is_fake_title:
                import random
                # Tur'a göre popüler içerik listesinden rastgele seç
                fallback_lists = {
                    "dizi": [
                        ("Breaking Bad", "Breaking Bad", "Efsanevi suç dizisi"),
                        ("Game of Thrones", "Game of Thrones", "Epik fantastik dizi"),
                        ("Stranger Things", "Stranger Things", "Nostaljik bilim kurgu"),
                        ("The Wire", "The Wire", "Gerçekçi suç draması"),
                        ("Chernobyl", "Chernobyl", "Tarihi mini dizi"),
                    ],
                    "film": [
                        ("Esaretin Bedeli", "The Shawshank Redemption", "Tüm zamanların en iyi filmi"),
                        ("Baba", "The Godfather", "Efsanevi mafya filmi"),
                        ("Kara Şövalye", "The Dark Knight", "En iyi süper kahraman filmi"),
                        ("Yıldızlararası", "Interstellar", "Epik bilim kurgu"),
                        ("Dövüş Kulübü", "Fight Club", "Kült klasik"),
                    ],
                    "kitap": [
                        ("Suç ve Ceza", "Crime and Punishment", "Dostoyevski'nin başyapıtı"),
                        ("1984", "1984", "Orwell'ın distopyası"),
                        ("Yüzüklerin Efendisi", "The Lord of the Rings", "Epik fantastik"),
                        ("Savaş ve Barış", "War and Peace", "Tolstoy'un şaheseri"),
                        ("Küçük Prens", "The Little Prince", "Zamansız klasik"),
                    ]
                }
                detected_tur = request.tur or tur or "film"
                fallback_list = fallback_lists.get(detected_tur, fallback_lists["film"])
                title, title_en, explanation = random.choice(fallback_list)
                tur = detected_tur
                parsed["explanation"] = explanation
            
            # Arama sorgusu oluştur
            search_query = title_en if title_en else title
            
            return IdentifyResponse(
                found=True,
                title=title,
                title_en=title_en,
                tur=tur,
                year=parsed.get("year"),
                explanation=parsed.get("explanation", ""),
                confidence=confidence,
                search_query=search_query
            )
        else:
            # JSON bulunamadı
            return IdentifyResponse(
                found=False,
                title="",
                title_en=None,
                tur=request.tur or "film",
                year=None,
                explanation="Tanımdan içerik belirlenemedi",
                confidence=0.0,
                search_query=request.description
            )
            
    except json.JSONDecodeError as e:
        print(f"JSON parse hatası: {e}")
        return IdentifyResponse(
            found=False,
            title="",
            title_en=None,
            tur=request.tur or "film",
            year=None,
            explanation="Yanıt işlenemedi",
            confidence=0.0,
            search_query=request.description
        )
    except Exception as e:
        print(f"Identify hatası: {e}")
        raise HTTPException(status_code=500, detail=f"İçerik tanımlama hatası: {str(e)}")


# ===== YENİ: Genel AI Chat Endpoint =====
@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Genel sohbet endpoint'i - Kullanıcıyla doğal dilde konuşma
    Film, dizi, kitap hakkında her türlü soruyu yanıtlar
    """
    try:
        # Saga asistanı system prompt'u
        system_prompt = """Sen Saga'nın AI asistanısın. Saga, kullanıcıların film, dizi ve kitapları takip ettiği bir platformdur.

Görevlerin:
1. Film, dizi ve kitaplar hakkında bilgi vermek (özet, oyuncular, yönetmenler, yazarlar, türler vs.)
2. İçerik önerileri yapmak
3. Kullanıcının sorularını yanıtlamak
4. Platform hakkında yardım etmek

Kurallar:
- Türkçe yanıt ver
- Kısa ve öz ol, gereksiz uzatma
- Spoiler vermekten kaçın (kullanıcı açıkça istemezse)
- Emin olmadığın bilgileri tahmin olarak belirt
- Samimi ve yardımsever ol"""

        # Mesajları OpenAI formatına çevir
        messages = [{"role": "system", "content": system_prompt}]
        
        # Kontekst varsa ekle
        if request.context:
            messages.append({"role": "system", "content": f"Kullanıcı şu anda şu sayfada: {request.context}"})
        
        # Sohbet geçmişini ekle
        for msg in request.messages:
            messages.append({"role": msg.role, "content": msg.content})
        
        # HuggingFace Router API ile çağır
        response_text = await call_hf_router_api(messages, request.max_tokens)
        
        if not response_text:
            return ChatResponse(
                message="AI yanıt veremedi. Lütfen tekrar deneyin.",
                suggestions=None
            )
        
        # Takip soruları öner
        suggestions = None
        if len(request.messages) <= 2:  # İlk birkaç mesajda öneri ver
            suggestions = [
                "Bu içeriğe benzer başka önerilerin var mı?",
                "Oyuncuları/yazarı hakkında bilgi verir misin?",
                "Bu içeriğin puanı nasıl?"
            ]
        
        return ChatResponse(
            message=response_text,
            suggestions=suggestions
        )
        
    except Exception as e:
        print(f"Chat hatası: {e}")
        raise HTTPException(status_code=500, detail=f"Sohbet hatası: {str(e)}")


# ===== YENİ: İçerik Hakkında Soru-Cevap =====
@app.post("/content-question", response_model=ContentQuestionResponse)
async def content_question(request: ContentQuestionRequest):
    """
    Belirli bir içerik hakkında soru yanıtla
    Örnek: "Inception filminin konusu ne?" veya "Bu kitabın yazarı kim?"
    """
    try:
        system_prompt = f"""Sen bir {request.content_type} uzmanısın. Kullanıcı "{request.content_title}" hakkında soru soruyor.

İçerik bilgisi:
- Başlık: {request.content_title}
- Tür: {request.content_type}
{f'- Açıklama: {request.content_description}' if request.content_description else ''}

Kurallar:
- Türkçe yanıt ver
- Spoiler vermekten kaçın (açıkça istenmezse)
- Kısa ve bilgilendirici ol
- Emin olmadığın bilgileri belirt"""

        user_prompt = request.question
        
        # HuggingFace Router API ile çağır
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        answer = await call_hf_router_api(messages, 400)
        
        if not answer:
            return ContentQuestionResponse(
                answer="AI yanıt veremedi. Lütfen tekrar deneyin.",
                related_questions=None
            )
        
        # İlgili sorular öner
        related_questions = [
            f"{request.content_title} ile benzer içerikler neler?",
            f"Bu {request.content_type}ın puanı kaç?",
            f"Kısaca özet verir misin?"
        ]
        
        return ContentQuestionResponse(
            answer=answer,
            related_questions=related_questions
        )
        
    except Exception as e:
        print(f"Content question hatası: {e}")
        raise HTTPException(status_code=500, detail=f"Soru yanıtlama hatası: {str(e)}")


# ===== YENİ: Site Asistanı =====
@app.post("/assistant", response_model=AssistantResponse)
async def assistant(request: AssistantRequest):
    """
    Site genelinde akıllı asistan
    Navigasyon, arama, öneri ve bilgi sağlar
    """
    try:
        query_lower = request.query.lower()
        
        # İçerik tanımlama isteği mi kontrol et
        # "bir film vardı", "şu dizi", "hangi kitap", "bulmaya çalışıyorum" gibi ifadeler
        identify_keywords = [
            "bir film", "şu film", "hangi film", "o film",
            "bir dizi", "şu dizi", "hangi dizi", "o dizi", 
            "bir kitap", "şu kitap", "hangi kitap", "o kitap",
            "bulmaya çalışıyorum", "hatırlamaya çalışıyorum", "adını unuttum",
            "vardı", "izlemiştim", "okumuştum", "gördüm",
            "ne filmdi", "ne dizisi", "ne kitabı", "hangi", "hangisi"
        ]
        
        is_identify_request = any(kw in query_lower for kw in identify_keywords)
        
        if is_identify_request:
            # İçerik tanımlama moduna geç
            identify_prompt = f"""Kullanıcı bir film, dizi veya kitap tanımlamaya çalışıyor. 
Tanımdan içeriğin adını bul.

Tanım: {request.query}

Sadece JSON formatında yanıt ver:
{{
    "found": true/false,
    "title": "İçeriğin Türkçe adı",
    "title_en": "İçeriğin İngilizce adı (varsa)",
    "content_type": "film/dizi/kitap",
    "message": "Kullanıcıya gösterilecek samimi mesaj"
}}"""
            
            messages = [
                {"role": "system", "content": "Sen bir film, dizi ve kitap uzmanısın. Tanımlardan içerikleri bul."},
                {"role": "user", "content": identify_prompt}
            ]
            
            response_text = await call_hf_router_api(messages, 250)
            
            if response_text:
                # JSON parse et
                json_str = extract_json(response_text)
                if json_str:
                    try:
                        parsed = json.loads(json_str)
                        if parsed.get("found") and parsed.get("title"):
                            title = parsed.get("title")
                            title_en = parsed.get("title_en")
                            content_type = parsed.get("content_type", "film")
                            
                            # Arama query'si oluştur
                            search_query = title_en if title_en else title
                            
                            message = parsed.get("message", f'"{title}" buldum! Aramaya yönlendiriyorum...')
                            
                            return AssistantResponse(
                                message=message,
                                action="search",
                                action_data={"query": search_query, "title": title, "type": content_type},
                                suggestions=[f"{title} hakkında bilgi ver", "Benzer içerikler öner"]
                            )
                    except json.JSONDecodeError:
                        pass
            
            # Bulunamadıysa
            return AssistantResponse(
                message="Tanımladığın içeriği bulamadım. Biraz daha detay verebilir misin?",
                action=None,
                action_data=None,
                suggestions=["Daha fazla detay ekle", "Başka bir şekilde tanımla"]
            )
        
        # Normal asistan modu
        system_prompt = """Sen Saga platformunun yardımcı asistanısın. Kullanıcılara kısa ve net yardım et.

Platform özellikleri:
- Kütüphane (/kutuphane): İzlenen film/dizi ve okunan kitaplar. Bir içeriği kütüphaneye eklemek için içerik sayfasındaki "Kütüphaneye Ekle" butonuna tıklanır.
- Listeler (/listeler): Özel koleksiyonlar oluşturma
- Keşfet (/kesfet): Yeni içerik arama ve keşfetme
- Profil (/profil): Kullanıcı istatistikleri
- Aktivite (/aktivite): Arkadaşların aktiviteleri

KURALLAR:
1. Sadece bilgi sorusu ise action=null olsun, sadece message ile yanıtla
2. Kullanıcı sayfaya gitmek istiyorsa action="navigate", action_data={"url": "/sayfa"}
3. Kullanıcı arama yapmak istiyorsa action="search", action_data={"query": "arama terimi"}
4. Kullanıcı öneri istiyorsa action="recommend"
5. message içine JSON yazma, düz metin yaz
6. Önceki sohbeti dikkate al ve bağlamı koru

Yanıt formatı (SADEce bu formatta):
{"message": "Kısa yanıt", "action": null, "action_data": null, "suggestions": ["Öneri"]}"""

        user_context_str = ""
        if request.user_context:
            user_context_str = f"\nKullanıcı: {request.user_context.get('username', 'misafir')}"
        
        page_context = ""
        if request.current_page:
            page_context = f" (Sayfa: {request.current_page})"
        
        user_prompt = f"Soru: {request.query}{page_context}{user_context_str}"

        # Mesaj listesi oluştur
        messages = [{"role": "system", "content": system_prompt}]
        
        # Sohbet geçmişini ekle (varsa)
        if request.chat_history:
            for msg in request.chat_history[-6:]:  # Son 6 mesaj (3 tur)
                messages.append({"role": msg.role, "content": msg.content})
        
        # Son kullanıcı mesajını ekle
        messages.append({"role": "user", "content": user_prompt})
        
        # HuggingFace Router API ile çağır
        response_text = await call_hf_router_api(messages, 400)
        
        if not response_text:
            return AssistantResponse(
                message="AI asistan yanıt veremedi. Lütfen tekrar deneyin.",
                action=None,
                action_data=None,
                suggestions=["Keşfet sayfasına git", "Kütüphaneme bak"]
            )
        
        # Yeni parse fonksiyonunu kullan (iç içe JSON desteği)
        parsed = parse_assistant_response(response_text)
        
        return AssistantResponse(
            message=parsed.get("message", response_text),
            action=parsed.get("action"),
            action_data=parsed.get("action_data"),
            suggestions=parsed.get("suggestions")
        )
        
    except Exception as e:
        print(f"Assistant hatası: {e}")
        raise HTTPException(status_code=500, detail=f"Asistan hatası: {str(e)}")


# ===== YENİ: Özet İste =====
@app.post("/summarize")
async def summarize_content(content_title: str, content_type: str, spoiler_free: bool = True):
    """
    Bir içeriğin özetini al
    """
    try:
        spoiler_note = "SPOILER VERME!" if spoiler_free else "Spoiler verebilirsin."
        
        system_prompt = f"""Sen bir {content_type} uzmanısın. "{content_title}" için kısa bir özet yaz.
{spoiler_note}
Türkçe yaz. 2-3 paragraf yeterli."""

        # HuggingFace Router API ile çağır
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"{content_title} hakkında özet ver."}
        ]
        summary = await call_hf_router_api(messages, 500)
        
        if not summary:
            return {"summary": "AI servisi şu anda kullanılamıyor.", "spoiler_free": spoiler_free}
        
        return {
            "title": content_title,
            "type": content_type,
            "summary": summary,
            "spoiler_free": spoiler_free
        }
        
    except Exception as e:
        print(f"Summarize hatası: {e}")
        raise HTTPException(status_code=500, detail=f"Özet hatası: {str(e)}")


# Gradio interface (HuggingFace Spaces için)
def create_gradio_interface():
    """Gradio arayüzü oluştur (opsiyonel)"""
    try:
        import gradio as gr
        
        def search_ui(query: str, tur: str, limit: int):
            if index is None:
                return "Index yok. Önce içerikleri yükleyin."
            
            tur_filter = tur if tur != "Hepsi" else None
            
            query_embedding = model.encode([query], convert_to_numpy=True)
            faiss.normalize_L2(query_embedding)
            
            scores, indices = index.search(query_embedding, limit)
            
            results = []
            for score, idx in zip(scores[0], indices[0]):
                if idx == -1:
                    continue
                item = content_data[idx]
                if tur_filter and item.get('tur', '').lower() != tur_filter.lower():
                    continue
                results.append(f"**{item.get('baslik')}** ({item.get('tur')}) - Skor: {score:.2f}\n{item.get('aciklama', '')[:100]}...")
            
            return "\n\n---\n\n".join(results) if results else "Sonuç bulunamadı"
        
        interface = gr.Interface(
            fn=search_ui,
            inputs=[
                gr.Textbox(label="Arama", placeholder="Film/kitap anlat veya ara..."),
                gr.Dropdown(["Hepsi", "film", "dizi", "kitap"], label="Tür", value="Hepsi"),
                gr.Slider(1, 10, value=5, step=1, label="Sonuç Sayısı")
            ],
            outputs=gr.Markdown(label="Sonuçlar"),
            title="🎬 Saga AI Search",
            description="Film, dizi ve kitap için semantic arama"
        )
        
        return interface
    except ImportError:
        return None


# HuggingFace Spaces için
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
