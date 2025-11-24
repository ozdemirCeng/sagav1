using System.ComponentModel.DataAnnotations.Schema;

namespace Saga.Server.Models
{
    [Table("liste_icerikleri")]
    public class ListeIcerigi
    {
        [Column("liste_id")]
        public long ListeId { get; set; }

        [Column("icerik_id")]
        public long IcerikId { get; set; }

        [Column("sira")]
        public int Sira { get; set; }

        [Column("not_metni")]
        public string? NotMetni { get; set; }

        [Column("eklenme_zamani")]
        public DateTime EklenmeZamani { get; set; } = DateTime.UtcNow;
    }
}