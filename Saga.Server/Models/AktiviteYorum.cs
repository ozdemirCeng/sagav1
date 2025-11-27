using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Saga.Server.Models
{
    [Table("aktivite_yorumlari")]
    public class AktiviteYorum
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Column("aktivite_id")]
        public long AktiviteId { get; set; }
        public Aktivite Aktivite { get; set; } = null!;

        [Column("kullanici_id")]
        public Guid KullaniciId { get; set; }
        public Kullanici Kullanici { get; set; } = null!;

        [Column("icerik")]
        public string Icerik { get; set; } = null!;

        [Column("ust_yorum_id")]
        public long? UstYorumId { get; set; }
        public AktiviteYorum? UstYorum { get; set; }
        public ICollection<AktiviteYorum> Yanitlar { get; set; } = new List<AktiviteYorum>();

        [Column("begeni_sayisi")]
        public int BegeniSayisi { get; set; } = 0;

        [Column("silindi")]
        public bool Silindi { get; set; } = false;

        [Column("olusturulma_zamani")]
        public DateTime OlusturulmaZamani { get; set; } = DateTime.UtcNow;

        [Column("guncelleme_zamani")]
        public DateTime GuncellemeZamani { get; set; } = DateTime.UtcNow;

        // Navigation
        public ICollection<AktiviteYorumBegeni> Begeniler { get; set; } = new List<AktiviteYorumBegeni>();
    }
}
