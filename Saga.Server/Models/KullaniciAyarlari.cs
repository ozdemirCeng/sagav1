using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Saga.Server.Models
{
    [Table("kullanici_ayarlari")]
    public class KullaniciAyarlari
    {
        [Key]
        [Column("kullanici_id")]
        public Guid KullaniciId { get; set; }
        public Kullanici Kullanici { get; set; } = null!;

        [Column("bildirim_yeni_takipci")]
        public bool BildirimYeniTakipci { get; set; } = true;

        [Column("bildirim_yorumlar")]
        public bool BildirimYorumlar { get; set; } = true;

        [Column("bildirim_begeniler")]
        public bool BildirimBegeniler { get; set; } = true;

        [Column("bildirim_oneriler")]
        public bool BildirimOneriler { get; set; } = false;

        [Column("bildirim_email")]
        public bool BildirimEmail { get; set; } = false;

        [Column("profil_gizli")]
        public bool ProfilGizli { get; set; } = false;

        [Column("aktivite_gizli")]
        public bool AktiviteGizli { get; set; } = false;

        [Column("tema")]
        public string Tema { get; set; } = "sistem";

        [Column("dil")]
        public string Dil { get; set; } = "tr";

        [Column("olusturulma_zamani")]
        public DateTime OlusturulmaZamani { get; set; } = DateTime.UtcNow;

        [Column("guncelleme_zamani")]
        public DateTime GuncellemeZamani { get; set; } = DateTime.UtcNow;
    }
}
