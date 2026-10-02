export interface Track {
  id: string;
  title: string;
  artist: string;
  /** 音频地址：可以是 /uploads/xxx.mp3 这类本地文件，也可以是第三方直链 */
  src: string;
  /** 封面图，可选 */
  cover?: string;
  /** 外链（例如网易云 / B 站），点击后新窗口打开 */
  link?: string;
}

/**
 * 默认歌单。把 mp3 放进 public/uploads/ 之后改这里即可，
 * 也可以在 MDX 里写 `<AudioPlayer src="..." title="..." />` 单独插入一首。
 */
export const defaultPlaylist: Track[] = [
  {
    id: "demo-1",
    title: "示例曲目 · 把 mp3 放进 public/uploads",
    artist: "华城",
    src: "",
  },
];

export function hasPlayableTrack(tracks: Track[]): boolean {
  return tracks.some((track) => Boolean(track.src));
}
