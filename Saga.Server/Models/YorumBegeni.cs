using System.ComponentModel.DataAnnotations.Schema;

namespace Saga.Server.Models
{
    [Table("yorum_begenileri")]
    public class YorumBegeni
    {
        [Column("kullanici_id")]
        public Guid KullaniciId { get; set; }

        [Column("yorum_id")]
        public long YorumId { get; set; }

        [Column("olusturulma_zamani")]
        public DateTime OlusturulmaZamani { get; set; } = DateTime.UtcNow;
    }
}