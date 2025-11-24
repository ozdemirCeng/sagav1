using System.ComponentModel.DataAnnotations.Schema;

namespace Saga.Server.Models
{
    [Table("takipler")]
    public class Takip
    {
        [Column("takip_eden_id")]
        public Guid TakipEdenId { get; set; }

        [Column("takip_edilen_id")]
        public Guid TakipEdilenId { get; set; }

        [Column("olusturulma_zamani")]
        public DateTime OlusturulmaZamani { get; set; }
    }
}