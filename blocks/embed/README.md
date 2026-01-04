# Embed Block

## Supported Embeds

- YouTube
- Vimeo
- Twitter
- Vidyard
- **Spotify (NEW)**

## Embedding a Spotify Player

To embed a Spotify player, simply paste a Spotify open URL (such as a track, album, playlist, episode, or show) into the embed block. Example:

```
https://open.spotify.com/episode/0mNkOdQtpTOxQxQvxFVP3m?si=35cf96d9a2a94290
```

The block will automatically convert this into an embedded Spotify player using the official Spotify embed format.

### Supported Spotify URL Types
- Track
- Album
- Playlist
- Episode
- Show

## Authoring Notes
- Only open.spotify.com URLs are supported for Spotify embeds.
- The player is responsive and will display at the recommended height for Spotify embeds.

## Developer Notes
- See https://developer.spotify.com/documentation/embeds/tutorials/creating-an-embed for details on the embed format.
- The embed logic is in `embed.js` under the Spotify handler.
