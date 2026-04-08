import { Controller } from "@hotwired/stimulus";
import Hls from 'hls.js';

export default class extends Controller {
  static targets = ["video", "transcript"];

  connect() {
    this.chapterItems = this.element.querySelectorAll('.chapter-item');
    this.transcriptItems = this.element.querySelectorAll('.transcript-item');

    if (this.hasVideoTarget) {
      this.videoTarget.addEventListener('timeupdate', this.handleTimeUpdate.bind(this));
    }

    this.hlsSetup();
  }

  disconnect() {
    if (this.hasVideoTarget) {
      this.videoTarget.removeEventListener('timeupdate', this.handleTimeUpdate.bind(this));
    }
  }

  hlsSetup() {
    const videoSrc = this.videoTarget.src;

    if (videoSrc.includes('.m3u8')) {
      if (Hls.isSupported()) {
        const urlObj = new URL(videoSrc);
        const signatureParams = urlObj.search;

        const hls = new Hls({
          xhrSetup: (xhr, url) => {
            if (!url.includes('Policy=') && signatureParams) {
              const separator = url.includes('?') ? '&' : '?';
              xhr.open('GET', url + separator + signatureParams.substring(1), true);
            }
          }
        });
        hls.loadSource(videoSrc);
        hls.attachMedia(this.videoTarget);
      }
    }
  }

  seekToTime(e) {
    this.seekTo(e.params.time);
  }

  seekToChapter(event) {
    const time = parseInt(event.params.time, 10);
    this.seekTo(time);

    this.chapterItems.forEach(item => item.classList.remove('active'));
    event.currentTarget.classList.add('active');
  }

  seekTo(seconds) {
    if (this.hasVideoTarget) {
      this.videoTarget.currentTime = seconds;
      this.videoTarget.play();
    }
  }

  handleTimeUpdate() {
    const currentTime = this.videoTarget.currentTime;

    this.updateActiveChapter(currentTime);

    this.updateActiveTranscript(currentTime);
  }

  updateActiveChapter(currentTime) {
    let activeChapter = null;

    this.chapterItems.forEach(item => {
      const chapterTime = parseInt(item.dataset.videoPlayerTimeParam, 10);
      if (currentTime >= chapterTime) {
        activeChapter = item;
      }
    });

    this.chapterItems.forEach(item => item.classList.remove('active'));
    if (activeChapter) {
      activeChapter.classList.add('active');
    }
  }

  updateActiveTranscript(currentTime) {
    let activeTranscript = null;

    this.transcriptItems.forEach(item => {
      const transcriptTime = parseInt(item.dataset.time, 10);
      if (currentTime >= transcriptTime) {
        activeTranscript = item;
      }
    });

    this.transcriptItems.forEach(item => item.classList.remove('active'));
    if (activeTranscript) {
      activeTranscript.classList.add('active');
    }
  }
}
