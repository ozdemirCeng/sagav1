using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Saga.Server.Models
{
    [Table("aktivite_yorum_begenileri")]
    public class AktiviteYorumBegeni
    {
        [Column("kullanici_id")]
        public Guid KullaniciId { get; set; }
        public Kullanici Kullanici { get; set; } = null!;

        [Column("yorum_id")]
        public long YorumId { get; set; }
        public AktiviteYorum Yorum { get; set; } = null!;

        [Column("olusturulma_zamani")]
        public DateTime OlusturulmaZamani { get; set; } = DateTime.UtcNow;
    }
}
