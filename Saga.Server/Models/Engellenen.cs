using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Saga.Server.Models
{
    [Table("engellenenler")]
    public class Engellenen
    {
        [Column("engelleyen_id")]
        public Guid EngellenenId { get; set; }
        public Kullanici EngellenenKullanici { get; set; } = null!;

        [Column("engellenen_id")]
        public Guid EngelleyenId { get; set; }
        public Kullanici EngelleyenKullanici { get; set; } = null!;

        [Column("olusturulma_zamani")]
        public DateTime OlusturulmaZamani { get; set; } = DateTime.UtcNow;
    }
}
