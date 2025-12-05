import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Loader2,
  Film,
  List,
  Grid3X3,
  GripVertical
} from 'lucide-react';
import { listeApi } from '../../services/api';
import './ListEditPage.css';

interface ListeIcerik {
  id?: number;
  icerikId: number;
  baslik: string;
  posterUrl?: string;
  tur: string;
  ortalamaPuan?: number;
  sira: number;
}

const ListEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [listeAdi, setListeAdi] = useState('');
  const [icerikler, setIcerikler] = useState<ListeIcerik[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  
  // Drag & Drop
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    if (id) fetchListe();
  }, [id]);

  const fetchListe = async () => {
    try {
      setLoading(true);
      const data = await listeApi.getById(Number(id));
      setListeAdi(data.ad || '');
      setIcerikler(data.icerikler?.sort((a: any, b: any) => (a.sira || 0) - (b.sira || 0)) || []);
    } catch (err) {
      console.error('Liste yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (icerikId: number) => {
    try {
      await listeApi.removeIcerik(Number(id), icerikId);
      setIcerikler(icerikler.filter(i => i.icerikId !== icerikId));
    } catch (err) {
      console.error('Silinemedi:', err);
    }
  };

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', '');
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newList = [...icerikler];
    const [draggedItem] = newList.splice(draggedIndex, 1);
    newList.splice(dropIndex, 0, draggedItem);
    
    setIcerikler(newList);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  if (loading) {
    return (
      <div className="liste-edit">
        <div className="liste-edit-loading">
          <Loader2 className="spin" size={32} />
        </div>
      </div>
    );
  }

  return (
    <div className="liste-edit">
      {/* Header */}
      <div className="liste-edit-header">
        <button className="liste-edit-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h1>{listeAdi}</h1>
        
        <div className="liste-edit-controls">
          {/* View Toggle */}
          <div className="view-toggle">
            <button 
              className={viewMode === 'list' ? 'active' : ''} 
              onClick={() => setViewMode('list')}
              title="Liste görünümü"
            >
              <List size={18} />
            </button>
            <button 
              className={viewMode === 'grid' ? 'active' : ''} 
              onClick={() => setViewMode('grid')}
              title="Poster görünümü"
            >
              <Grid3X3 size={18} />
            </button>
          </div>
          
          <button className="liste-edit-add" onClick={() => navigate('/kesfet')}>
            <Plus size={20} />
            <span>Ekle</span>
          </button>
        </div>
      </div>

      {/* İçerik */}
      <div className="liste-edit-content">
        {icerikler.length === 0 ? (
          <div className="liste-edit-empty">
            <Film size={48} />
            <p>Liste boş</p>
            <span>Keşfet'e giderek içerik ekleyin</span>
          </div>
        ) : viewMode === 'list' ? (
          /* Liste Görünümü */
          <div className="liste-view-list">
            {icerikler.map((item, index) => (
              <div 
                key={item.icerikId} 
                className={`liste-item ${draggedIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
              >
                <div className="liste-item-drag">
                  <GripVertical size={18} />
                </div>
                <span className="liste-item-num">{index + 1}</span>
                <div className="liste-item-poster">
                  {item.posterUrl ? (
                    <img src={item.posterUrl} alt={item.baslik} />
                  ) : (
                    <div className="liste-item-poster-empty">
                      <Film size={20} />
                    </div>
                  )}
                </div>
                <div className="liste-item-info">
                  <span className="liste-item-title">{item.baslik}</span>
                  <span className="liste-item-type">{item.tur}</span>
                </div>
                <button 
                  className="liste-item-delete"
                  onClick={() => handleRemove(item.icerikId)}
                  title="Sil"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          /* Grid/Poster Görünümü */
          <div className="liste-view-grid">
            {icerikler.map((item, index) => (
              <div 
                key={item.icerikId} 
                className={`grid-item ${draggedIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
              >
                <div className="grid-item-poster">
                  {item.posterUrl ? (
                    <img src={item.posterUrl} alt={item.baslik} />
                  ) : (
                    <div className="grid-item-poster-empty">
                      <Film size={32} />
                    </div>
                  )}
                  <span className="grid-item-num">{index + 1}</span>
                  <button 
                    className="grid-item-delete"
                    onClick={(e) => { e.stopPropagation(); handleRemove(item.icerikId); }}
                    title="Sil"
                  >
                    <Trash2 size={16} />
                  </button>
                  <div className="grid-item-drag">
                    <GripVertical size={16} />
                  </div>
                </div>
                <span className="grid-item-title">{item.baslik}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ListEditPage;
