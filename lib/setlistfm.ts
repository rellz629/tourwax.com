/**
 * Setlist.fm API integration
 * Docs: https://api.setlist.fm/docs/1.0/index.html
 * Requires SETLISTFM_API_KEY environment variable
 */

const BASE_URL = 'https://api.setlist.fm/rest/1.0';

interface SetlistFmSong {
  name: string;
  info?: string;
  cover?: { name: string };
  tape?: boolean;
}

interface SetlistFmSet {
  name?: string;
  encore?: number;
  song?: SetlistFmSong[];
}

interface SetlistFmSetlist {
  id: string;
  eventDate: string; // dd-MM-yyyy
  artist: { name: string; mbid: string };
  venue: {
    name: string;
    city: { name: string; state?: string; country: { name: string } };
  };
  sets: { set?: SetlistFmSet[] };
  url: string;
}

interface SetlistFmResponse {
  setlist?: SetlistFmSetlist[];
  total?: number;
}

export interface Setlist {
  id: string;
  date: string; // ISO date
  venueName: string;
  cityName: string;
  url: string;
  songs: SetlistSong[];
}

export interface SetlistSong {
  name: string;
  info?: string;
  isCover: boolean;
  coverArtist?: string;
  isTape: boolean;
  encore?: number;
}

function parseSetlistDate(dateStr: string): string {
  // Convert dd-MM-yyyy to ISO date
  const [day, month, year] = dateStr.split('-');
  return `${year}-${month}-${day}`;
}

function extractSongs(sets: SetlistFmSet[]): SetlistSong[] {
  const songs: SetlistSong[] = [];

  for (const set of sets) {
    if (!set.song) continue;
    for (const song of set.song) {
      songs.push({
        name: song.name,
        info: song.info,
        isCover: !!song.cover,
        coverArtist: song.cover?.name,
        isTape: song.tape ?? false,
        encore: set.encore,
      });
    }
  }

  return songs;
}

export async function getArtistSetlists(artistName: string, limit: number = 3, musicbrainzId?: string | null): Promise<Setlist[]> {
  const apiKey = process.env.SETLISTFM_API_KEY;
  if (!apiKey) return [];

  try {
    // Use MBID-based lookup when available (more reliable for special characters)
    let url: string;
    if (musicbrainzId) {
      const params = new URLSearchParams({ p: '1' });
      url = `${BASE_URL}/artist/${musicbrainzId}/setlists?${params}`;
    } else {
      const params = new URLSearchParams({ artistName, p: '1' });
      url = `${BASE_URL}/search/setlists?${params}`;
    }

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'x-api-key': apiKey,
      },
      next: { revalidate: 86400 }, // Cache for 24 hours
    });

    if (!response.ok) return [];

    const data: SetlistFmResponse = await response.json();
    if (!data.setlist) return [];

    // Filter to setlists that actually have songs listed
    const withSongs = data.setlist.filter(
      (s) => s.sets.set && s.sets.set.some((set) => set.song && set.song.length > 0)
    );

    return withSongs.slice(0, limit).map((s) => ({
      id: s.id,
      date: parseSetlistDate(s.eventDate),
      venueName: s.venue.name,
      cityName: [s.venue.city.name, s.venue.city.state, s.venue.city.country.name]
        .filter(Boolean)
        .join(', '),
      url: s.url.startsWith('https://') ? s.url : `https://www.setlist.fm/setlist/${s.id}`,
      songs: extractSongs(s.sets.set || []),
    }));
  } catch {
    return [];
  }
}
