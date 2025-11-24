using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Saga.Server.Data;
using Saga.Server.Models;

namespace Saga.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class IceriklerController : ControllerBase
    {
        private readonly SagaDbContext _context;

        public IceriklerController(SagaDbContext context)
        {
            _context = context;
        }

        // GET: api/icerikler
        [HttpGet]
        public async Task<IActionResult> GetIcerikler([FromQuery] int page = 1, [FromQuery] int limit = 20)
        {
            var icerikler = await _context.Icerikler
                .OrderByDescending(i => i.PopulerlikSkoru)
                .Skip((page - 1) * limit)
                .Take(limit)
                .ToListAsync();

            return Ok(icerikler);
        }

        // GET: api/icerikler/search?q=matrix
        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string q)
        {
            if (string.IsNullOrEmpty(q)) return BadRequest();

            // PostgreSQL Full Text Search (Basit ILIKE kullanımı)
            var sonuclar = await _context.Icerikler
                .Where(i => EF.Functions.ILike(i.Baslik, $"%{q}%"))
                .Take(10)
                .ToListAsync();

            return Ok(sonuclar);
        }
    }
}