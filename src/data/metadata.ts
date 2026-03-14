import type { SeriesMeta, WatchOrderEntry } from '../types';

export const SERIES_META: Record<string, SeriesMeta> = {
  "01": {
    synopsis: "Koyomi Araragi, seorang siswa SMA yang nyaris menjadi vampir, menemukan bahwa berbagai gadis di sekitarnya memiliki masalah supernatural mereka sendiri.",
    genre: ["Mystery", "Supernatural", "Romance", "Comedy"],
    year: 2009,
    gradient: ["#6a0dad", "#1a0a2e"],
    kanji: "化物語"
  },
  "02": {
    synopsis: "Selama liburan musim semi, Koyomi Araragi bertemu dengan vampir legendaris Kiss-Shot dan mempertaruhkan nyawanya untuk menyelamatkannya.",
    genre: ["Action", "Mystery", "Supernatural"],
    year: 2016,
    gradient: ["#8b0000", "#1a0000"],
    kanji: "傷物語"
  },
  "03": {
    synopsis: "Araragi menghadapi dua bersaudara Fire Sisters yang terlibat dengan penipu supernatural dan lebah berbahaya.",
    genre: ["Comedy", "Supernatural", "Ecchi"],
    year: 2012,
    gradient: ["#ff4500", "#1a0800"],
    kanji: "偽物語"
  },
  "04": {
    synopsis: "Selama Golden Week, Araragi menghadapi Hanekawa yang dikuasai oleh kucing supernatural bernama Black Hanekawa.",
    genre: ["Supernatural", "Psychological", "Drama"],
    year: 2012,
    gradient: ["#1c1c1c", "#0a0a0a"],
    kanji: "猫物語（黒）"
  },
  "05": {
    synopsis: "Koleksi arc dari Second Season — Nekomonogatari Shiro, Kabukimonogatari, Hanamonogatari, Otorimonogatari, Onimonogatari, dan Koimonogatari.",
    genre: ["Mystery", "Supernatural", "Drama", "Romance"],
    year: 2013,
    gradient: ["#0077b6", "#001a2e"],
    kanji: "セカンドシーズン",
    arcs: [
      { name: "Nekomonogatari Shiro", prefix: "Nekomonogatari Shiro", eps: ["01","02","03","04","05"], color: "#e0e0e0" },
      { name: "Kabukimonogatari", prefix: "Kabukimonogatari", eps: ["01","02","03","04"], color: "#f5a623" },
      { name: "Hanamonogatari", prefix: "Hanamonogatari", eps: ["01","02","03","04","05"], color: "#ff69b4" },
      { name: "Otorimonogatari", prefix: "Otorimonogatari", eps: ["01","02","03","04"], color: "#ffa07a" },
      { name: "Onimonogatari", prefix: "Onimonogatari", eps: ["01","02","03","04"], color: "#9370db" },
      { name: "Koimonogatari", prefix: "Koimonogatari", eps: ["01","02","03","04","05","06"], color: "#ff1493" }
    ]
  },
  "06": {
    synopsis: "Araragi menemukan bahwa tubuhnya perlahan berubah — efek dari pengaruh vampir yang tidak sepenuhnya hilang.",
    genre: ["Supernatural", "Drama", "Mystery"],
    year: 2014,
    gradient: ["#c0c0c0", "#1a1a2e"],
    kanji: "憑物語"
  },
  "07": {
    synopsis: "12 episode pendek mengikuti Koyomi Araragi menjalani kehidupan sehari-hari selama setahun.",
    genre: ["Comedy", "Supernatural", "Slice of Life"],
    year: 2016,
    gradient: ["#228b22", "#0a1a0a"],
    kanji: "暦物語"
  },
  "08": {
    synopsis: "Araragi menghadapi masa lalunya dan misteri Sodachi Oikura, sekaligus mengungkap rahasia Ougi Oshino.",
    genre: ["Mystery", "Supernatural", "Psychological"],
    year: 2015,
    gradient: ["#ff6347", "#1a0a00"],
    kanji: "終物語"
  },
  "09": {
    synopsis: "Klimaks akhir — Araragi harus menghadapi kebenaran tentang Ougi Oshino dan menyelesaikan semua misteri.",
    genre: ["Mystery", "Supernatural", "Drama"],
    year: 2017,
    gradient: ["#ffd700", "#1a1500"],
    kanji: "終物語 2nd"
  },
  "10": {
    synopsis: "Koyomi Araragi lulus SMA dan memasuki dunia cermin di mana segalanya terbalik.",
    genre: ["Supernatural", "Comedy", "Psychological"],
    year: 2018,
    gradient: ["#00ced1", "#001a1a"],
    kanji: "続・終物語"
  },
  "11": {
    synopsis: "Off Season & Monster Season — arc-arc baru yang melanjutkan cerita Monogatari dengan perspektif baru.",
    genre: ["Supernatural", "Mystery", "Action"],
    year: 2024,
    gradient: ["#9b59b6", "#1a0a2e"],
    kanji: "オフ&モンスター"
  }
};

export const WATCH_ORDER_CHRONOLOGICAL: WatchOrderEntry[] = [
  { seriesId: "02", label: "Kizumonogatari I – Tekketsu-hen", filterPrefix: "Kizumonogatari I", type: "movie" },
  { seriesId: "02", label: "Kizumonogatari II – Nekketsu-hen", filterPrefix: "Kizumonogatari II", type: "movie" },
  { seriesId: "02", label: "Kizumonogatari III – Reiketsu-hen", filterPrefix: "Kizumonogatari III", type: "movie" },
  { seriesId: "04", label: "Nekomonogatari Kuro", type: "series" },
  { seriesId: "01", label: "Bakemonogatari", type: "series" },
  { seriesId: "03", label: "Nisemonogatari", type: "series" },
  { seriesId: "05", label: "Nekomonogatari Shiro", filterPrefix: "Nekomonogatari Shiro", type: "arc" },
  { seriesId: "05", label: "Kabukimonogatari", filterPrefix: "Kabukimonogatari", type: "arc" },
  { seriesId: "05", label: "Hanamonogatari", filterPrefix: "Hanamonogatari", type: "arc" },
  { seriesId: "05", label: "Otorimonogatari", filterPrefix: "Otorimonogatari", type: "arc" },
  { seriesId: "05", label: "Onimonogatari", filterPrefix: "Onimonogatari", type: "arc" },
  { seriesId: "05", label: "Koimonogatari", filterPrefix: "Koimonogatari", type: "arc" },
  { seriesId: "06", label: "Tsukimonogatari", type: "series" },
  { seriesId: "08", label: "Owarimonogatari", type: "series" },
  { seriesId: "09", label: "Owarimonogatari 2nd Season", type: "series" },
  { seriesId: "10", label: "Zoku Owarimonogatari", type: "series" },
  { seriesId: "11", label: "Off & Monster Season", type: "series" }
];

export const WATCH_ORDER_TV: WatchOrderEntry[] = [
  { seriesId: "01", label: "Bakemonogatari", type: "series" },
  { seriesId: "03", label: "Nisemonogatari", type: "series" },
  { seriesId: "04", label: "Nekomonogatari Kuro", type: "series" },
  { seriesId: "05", label: "Nekomonogatari Shiro", filterPrefix: "Nekomonogatari Shiro", type: "arc" },
  { seriesId: "05", label: "Kabukimonogatari", filterPrefix: "Kabukimonogatari", type: "arc" },
  { seriesId: "05", label: "Hanamonogatari", filterPrefix: "Hanamonogatari", type: "arc" },
  { seriesId: "05", label: "Otorimonogatari", filterPrefix: "Otorimonogatari", type: "arc" },
  { seriesId: "05", label: "Onimonogatari", filterPrefix: "Onimonogatari", type: "arc" },
  { seriesId: "05", label: "Koimonogatari", filterPrefix: "Koimonogatari", type: "arc" },
  { seriesId: "06", label: "Tsukimonogatari", type: "series" },
  { seriesId: "08", label: "Owarimonogatari", type: "series" },
  { seriesId: "09", label: "Owarimonogatari 2nd Season", type: "series" },
  { seriesId: "10", label: "Zoku Owarimonogatari", type: "series" },
  { seriesId: "02", label: "Kizumonogatari I – Tekketsu-hen", filterPrefix: "Kizumonogatari I", type: "movie" },
  { seriesId: "02", label: "Kizumonogatari II – Nekketsu-hen", filterPrefix: "Kizumonogatari II", type: "movie" },
  { seriesId: "02", label: "Kizumonogatari III – Reiketsu-hen", filterPrefix: "Kizumonogatari III", type: "movie" },
  { seriesId: "11", label: "Off & Monster Season", type: "series" }
];
