import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { TranscriptMessage } from './types.js';

@customElement('transcript-viewer')
export class TranscriptViewer extends LitElement {
  @property({ attribute: false }) transcriptHistory: TranscriptMessage[] = [];
  @property({ type: Number }) transcriptFontSize = 26;
  @property({ attribute: false }) knownWordForms: Set<string> = new Set();

  static styles = css`
    .transcript-messages-container {
      flex-grow: 1;
      overflow-y: auto;
      padding: 20px;
    }
    .transcript-messages {
      display: flex;
      flex-direction: column;
      gap: 0px;
    }
    .transcript-message {
      background-color: #3c3152;
      padding: 8px 12px;
      line-height: 1.5;
      color: #e0e0e0;
      word-wrap: break-word;
      margin-top: 0;
      margin-bottom: 0;
      border-radius: 10px;
    }
    .transcript-message.user {
      background-color: #34495e;
      color: #ecf0f1;
    }
    .clickable-word {
      cursor: pointer;
      text-decoration: underline;
      text-decoration-color: #a093c4;
      text-decoration-thickness: 1px;
      text-underline-offset: 3px;
      padding-bottom: 1px;
    }
    .clickable-word.known-word {
      color: #60a5fa;
      text-decoration-color: #93c5fd;
    }
  `;

  private renderMessage(text: string) {
    const tokens = text.split(/(\s+)/);
    return tokens.map(token => {
      if (token.trim() === '') return token;
      const key = token.replace(/[.,!?;:()"']/g, '').toLowerCase();
      const known = this.knownWordForms.has(key);
      return html`<span
        class="clickable-word ${known ? 'known-word' : ''}"
        @click=${(e: MouseEvent) => {
          this.dispatchEvent(new CustomEvent('word-click', {
            detail: { word: token, sentence: text, event: e },
            bubbles: true,
            composed: true,
          }));
        }}>
          ${token}
        </span>`;
    });
  }

  render() {
    return html`
      <div class="transcript-messages-container">
        <div class="transcript-messages">
          ${this.transcriptHistory.map((msg, index, arr) => html`
            <p
              class="transcript-message ${msg.speaker === 'user' ? 'user' : ''} ${index === arr.length - 1 ? 'latest' : ''}"
              style="font-size: ${this.transcriptFontSize}px;"
              data-speaker=${msg.speaker}
            >${this.renderMessage(msg.text)}</p>
          `)}
        </div>
      </div>
    `;
  }
}
