use regex::Regex;

#[derive(Debug, Clone)]
pub struct ParsedEpisode {
    pub season: u32,
    pub episode: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedMovie {
    pub title: String,
    pub year: Option<i32>,
}

fn strip_video_extensions(name: &str) -> String {
    let mut stem = name.to_string();
    loop {
        let lower = stem.to_lowercase();
        let ext = [
            ".mkv.mp4", ".mp4", ".mkv", ".avi", ".webm", ".mov", ".m4v", ".wmv", ".ts", ".m2ts",
        ]
        .iter()
        .find(|ext| lower.ends_with(*ext));
        match ext {
            Some(ext) => stem.truncate(stem.len() - ext.len()),
            None => break,
        }
    }
    stem
}

fn split_camel_case(s: &str) -> String {
    let re = Regex::new(r"([a-z])([A-Z])").unwrap();
    re.replace_all(s, "$1 $2").into_owned()
}

fn is_junk_token(token: &str) -> bool {
    let t = token.trim_matches(|c: char| !c.is_ascii_alphanumeric()).to_lowercase();
    if t.is_empty() {
        return true;
    }
    if Regex::new(r"^\d{3,4}p$").unwrap().is_match(&t) {
        return true;
    }
    if Regex::new(r"^\d{2,4}(mb|gb)$").unwrap().is_match(&t) {
        return true;
    }
    matches!(
        t.as_str(),
        "1080p"
            | "720p"
            | "480p"
            | "2160p"
            | "4k"
            | "uhd"
            | "hdr"
            | "hdr10"
            | "dv"
            | "bluray"
            | "blu"
            | "ray"
            | "bdrip"
            | "brrip"
            | "webrip"
            | "web"
            | "webdl"
            | "hdrip"
            | "dvdrip"
            | "hdtv"
            | "x264"
            | "x265"
            | "h264"
            | "h265"
            | "hevc"
            | "avc"
            | "av1"
            | "10bit"
            | "8bit"
            | "aac"
            | "ac3"
            | "eac3"
            | "dts"
            | "truehd"
            | "atmos"
            | "dd5"
            | "dd2"
            | "6ch"
            | "8ch"
            | "2ch"
            | "nf"
            | "amzn"
            | "dsnp"
            | "hulu"
            | "atvp"
            | "yts"
            | "yify"
            | "rarbg"
            | "galaxyrg"
            | "rmteam"
            | "psa"
            | "evo"
            | "sparks"
            | "proper"
            | "repack"
            | "internal"
            | "readnfo"
            | "nfo"
            | "triaudio"
            | "dual"
            | "multi"
            | "extended"
            | "unrated"
            | "directors"
            | "remux"
            | "imax"
            | "hc"
            | "sub"
            | "subs"
            | "subtitle"
            | "subtitles"
            | "sinhala"
            | "tamil"
            | "hindi"
            | "english"
            | "eng"
            | "dub"
            | "dubbed"
            | "baiscopelk"
            | "piratelk"
            | "tamilmv"
            | "com"
            | "www"
            | "mx"
            | "aac5"
    )
}

pub fn parse_movie(filename: &str) -> ParsedMovie {
    let name = filename.rsplit(['/', '\\']).next().unwrap_or(filename);
    let mut stem = strip_video_extensions(name);
    stem = Regex::new(r"\[[^\]]*\]").unwrap().replace_all(&stem, " ").into_owned();
    // Keep (YYYY) year markers; strip other parenthetical groups.
    stem = Regex::new(r"\([^)]*\)")
        .unwrap()
        .replace_all(&stem, |caps: &regex::Captures| {
            let inner = &caps[0][1..caps[0].len() - 1];
            if Regex::new(r"^(19|20)\d{2}$").unwrap().is_match(inner) {
                format!(" {inner} ")
            } else {
                " ".to_string()
            }
        })
        .into_owned();
    stem = Regex::new(r"(?i)\b(?:5\.1|7\.1|2\.0|6\.1)\b").unwrap().replace_all(&stem, " ").into_owned();
    // Strip domain-like site tags: baiscopelk.com, pirateLK.com
    stem = Regex::new(r"(?i)\b[\w-]+\.(com|net|org|lk|info)\b")
        .unwrap()
        .replace_all(&stem, " ")
        .into_owned();
    stem = stem.replace(['.', '_', '-', '+'], " ");
    stem = split_camel_case(&stem);

    let tokens: Vec<String> = stem
        .split_whitespace()
        .filter(|t| !is_junk_token(t))
        .map(|t| t.to_string())
        .collect();

    let year_re = Regex::new(r"^(19|20)\d{2}$").unwrap();
    let year_idx = tokens.iter().position(|t| year_re.is_match(t));
    let year = year_idx.and_then(|i| tokens[i].parse::<i32>().ok());

    let title_tokens = if let Some(i) = year_idx {
        &tokens[..i]
    } else {
        &tokens[..]
    };
    let title = title_tokens.join(" ").trim().to_string();

    ParsedMovie {
        title: if title.is_empty() {
            tokens.join(" ")
        } else {
            title
        },
        year,
    }
}

pub fn parse_movie_title(filename: &str) -> String {
    parse_movie(filename).title
}

pub fn parse_episode(filename: &str) -> Option<ParsedEpisode> {
    let name = filename.rsplit(['/', '\\']).next().unwrap_or(filename);

    // S01E01 or s1e1
    let re_sxe = Regex::new(r"(?i)s(\d{1,2})e(\d{1,3})").unwrap();
    if let Some(caps) = re_sxe.captures(name) {
        return Some(ParsedEpisode {
            season: caps[1].parse().unwrap_or(1),
            episode: caps[2].parse().unwrap_or(1),
        });
    }

    // `[AH2] Assassination Classroom S1 - 01` or `Kusuriya no Hitorigoto S1 - 12`
    let re_s_dash = Regex::new(r"(?i)\bs(\d{1,2})\s*[-–—]\s*(\d{1,3})\b").unwrap();
    if let Some(caps) = re_s_dash.captures(name) {
        return Some(ParsedEpisode {
            season: caps[1].parse().unwrap_or(1),
            episode: caps[2].parse().unwrap_or(1),
        });
    }

    // " - 01 " or " - 01." anime style (absolute episode numbers)
    let re_dash = Regex::new(r"(?i)[\s\-–—]+(\d{1,3})(?:\s|\(|\.|\[|$)").unwrap();
    if let Some(caps) = re_dash.captures(name) {
        return Some(ParsedEpisode {
            season: 1,
            episode: caps[1].parse().unwrap_or(1),
        });
    }

    None
}

pub fn clean_show_title(folder_name: &str) -> String {
    parse_show_title(folder_name)
}

/// Turn a messy folder or file name into a TMDB search title.
/// `The Mentalist S02E16 sinhala` → `The Mentalist`
/// `Gotham (2014) Season 1` → `Gotham`
pub fn parse_show_title(name: &str) -> String {
    let name = name.rsplit(['/', '\\']).next().unwrap_or(name);
    let mut stem = strip_video_extensions(name);
    stem = Regex::new(r"\[[^\]]*\]").unwrap().replace_all(&stem, " ").into_owned();
    stem = Regex::new(r"\((19|20)\d{2}\)").unwrap().replace_all(&stem, " ").into_owned();
    stem = Regex::new(r"(?i)\bseason\s*\d+\b").unwrap().replace_all(&stem, " ").into_owned();
    stem = Regex::new(r"(?i)\bs\d{1,2}e\d{1,3}\b").unwrap().replace_all(&stem, " ").into_owned();
    stem = Regex::new(r"(?i)\bs\d{1,2}\b").unwrap().replace_all(&stem, " ").into_owned();
    stem = stem.replace(['.', '_', '-', '+'], " ");

    let junk = [
        "sinhala", "tamil", "hindi", "english", "eng", "sub", "subs", "dub", "dubbed",
        "1080p", "720p", "480p", "2160p", "bluray", "webrip", "webdl", "x264", "x265",
        "hevc", "hdtv", "proper", "repack", "tv", "series", "pahe", "neonoir", "vyndros",
        "flux", "heteam", "me gusta", "eztv",
    ];
    let tokens: Vec<String> = stem
        .split_whitespace()
        .filter(|t| {
            let l = t.to_lowercase();
            !junk.contains(&l.as_str()) && !is_junk_token(t)
        })
        .map(|t| t.to_string())
        .collect();
    tokens.join(" ").trim().to_string()
}

/// Extract show title from typical anime release filenames:
/// `[SubsPlease] Yuusha-kei ni Shosu - 01 (1080p) [hash].mkv` → `Yuusha-kei ni Shosu`
pub fn parse_anime_show_title(filename: &str) -> Option<String> {
    let name = filename.rsplit(['/', '\\']).next().unwrap_or(filename);
    let name = name
        .rsplit_once('.')
        .map(|(n, _)| n)
        .unwrap_or(name);
    // Strip trailing .mkv from .mkv.mp4
    let name = name.strip_suffix(".mkv").unwrap_or(name);

    let re = Regex::new(r"(?i)^(?:\[[^\]]+\]\s*)?(.+?)\s-\s*(\d{1,3})\b").unwrap();
    let caps = re.captures(name)?;
    let title = caps[1].trim();
    if title.is_empty() {
        return None;
    }
    let mut title = title.replace('.', " ").replace('_', " ");
    title = Regex::new(r"(?i)\bs\d{1,2}\b")
        .unwrap()
        .replace_all(&title, " ")
        .into_owned();
    let title = title.split_whitespace().collect::<Vec<_>>().join(" ");
    if title.is_empty() {
        None
    } else {
        Some(title)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_scene_movie_names() {
        let a = parse_movie("AmericanSniper.2014.1080p.bluray.x264.TriAudio.mp4");
        assert_eq!(a.title, "American Sniper");
        assert_eq!(a.year, Some(2014));

        let b = parse_movie("Candlewood.2025.720p._.x264.AAC-[YTS.MX].mp4");
        assert_eq!(b.title, "Candlewood");
        assert_eq!(b.year, Some(2025));

        let c = parse_movie("Dog Man 2025 1080p BluRay DD5.1 HEVC x265-RMTeam.mkv");
        assert_eq!(c.title, "Dog Man");
        assert_eq!(c.year, Some(2025));

        let e = parse_movie("Eddington 2025 720p 10bit _ 6CH x265 HEVC-PSA.mkv");
        assert_eq!(e.title, "Eddington");
        assert_eq!(e.year, Some(2025));

        let f = parse_movie("Enola.Holmes.2.2022.720p.NF.WEBRip.900MB.x264-GalaxyRG.mkv");
        assert_eq!(f.title, "Enola Holmes 2");
        assert_eq!(f.year, Some(2022));

        let g = parse_movie("The.Batman.2022.1080p.sinhala.sub-baiscopelk.com.mkv");
        assert_eq!(g.title, "The Batman");
        assert_eq!(g.year, Some(2022));

        let h = parse_movie("Final.Cut.2022.720p.BluRay.x264.mp4");
        assert_eq!(h.title, "Final Cut");
        assert_eq!(h.year, Some(2022));
    }

    #[test]
    fn parse_messy_show_names() {
        assert_eq!(
            parse_show_title("The Mentalist S02E16 sinhala 720p"),
            "The Mentalist"
        );
        assert_eq!(
            parse_show_title("Gotham (2014) Season 1 S01"),
            "Gotham"
        );
        assert_eq!(
            parse_show_title("Sherlck Holmes TV Series"),
            "Sherlck Holmes"
        );
    }

    #[test]
    fn parse_anime_title_from_subsplease() {
        let f = "[SubsPlease] Yuusha-kei ni Shosu - 01 (1080p) [F4CAACBB].mkv.mp4";
        assert_eq!(
            parse_anime_show_title(f).as_deref(),
            Some("Yuusha-kei ni Shosu")
        );
    }

    #[test]
    fn parse_s1_dash_episode_not_season_as_episode() {
        let f = "[AH2] Assassination Classroom S1 - 12 (1080p).mkv.mp4";
        let ep = parse_episode(f).expect("episode");
        assert_eq!(ep.season, 1);
        assert_eq!(ep.episode, 12);
        assert_eq!(
            parse_anime_show_title(f).as_deref(),
            Some("Assassination Classroom")
        );
    }

    #[test]
    fn parse_absolute_anime_episode() {
        let f = "[SubsPlease] Kusuriya no Hitorigoto - 25 (1080p) [E13EC489].mkv.mp4";
        let ep = parse_episode(f).expect("episode");
        assert_eq!(ep.season, 1);
        assert_eq!(ep.episode, 25);
        assert_eq!(
            parse_anime_show_title(f).as_deref(),
            Some("Kusuriya no Hitorigoto")
        );
    }
}
