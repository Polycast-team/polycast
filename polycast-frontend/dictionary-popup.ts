import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { WordPopupData } from './types.js';

@customElement('dictionary-popup')
export class DictionaryPopup extends LitElement {
  @property({ attribute: false }) popupData: WordPopupData | null = null;
  @property({ type: Boolean }) loading = false;
  @property({ type: String }) error: string | null = null;
  @property({ type: Boolean }) inDictionary = false;
  @property() nativeLanguage = '';
  @property() targetLanguage = '';
  @property({ type: Boolean }) disableToggle = false;

  static styles = css`
    .popup-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: transparent;
      z-index: 999;
    }
    .word-popup {
      position: fixed;
      background-color: #2a2139;
      border: 1px solid #3c3152;
      border-radius: 8px;
      padding: 15px 20px;
      z-index: 1000;
      min-width: 250px;
      max-width: 380px;
      box-shadow: 0 5px 15px rgba(0,0,0,0.2);
      color: #e0e0e0;
      font-size: 14px;
      line-height: 1.5;
      transform: translateX(-50%);
    }
    .dictionary-toggle-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      background-color: #4a3f63;
      color: #e0e0e0;
    }
    .dictionary-toggle-btn.added {
      background-color: #3cb371;
      color: #ffffff;
    }
    .popup-close-btn {
      position: absolute;
      top: 10px;
      right: 12px;
      background: none;
      border: none;
      color: #bca0dc;
      font-size: 1.6em;
      font-weight: bold;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }
  `;

  private onToggle() {
    if (!this.popupData) return;
    this.dispatchEvent(new CustomEvent('toggle-dictionary', {
      detail: this.popupData,
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    if (!this.popupData) return html``;
    return html`
      <div class="popup-overlay" @click=${() => this.dispatchEvent(new CustomEvent('close-popup', { bubbles: true, composed: true }))} role="presentation"></div>
      <div class="word-popup" style="top:${this.popupData.y}px; left:${this.popupData.x}px;" role="dialog">
        <button @click=${() => this.dispatchEvent(new CustomEvent('close-popup', { bubbles: true, composed: true }))} class="popup-close-btn" aria-label="Close">&times;</button>
        <div class="word-popup-header">
          <span class="popup-selected-word">${this.popupData.displayWord || this.popupData.word}</span>
          <button class="dictionary-toggle-btn ${this.inDictionary ? 'added' : ''}" @click=${this.onToggle} ?disabled=${this.disableToggle} title="Toggle dictionary">${this.inDictionary ? '✓' : '+'}</button>
        </div>
        ${this.loading ? html`<p>Loading details...</p>` : this.error ? html`<p>${this.error}</p>` : html`
          ${this.popupData.translation ? html`<div><span class="popup-label">Translation (to ${this.nativeLanguage})</span><span class="popup-content-text">${this.popupData.translation}</span></div>` : ''}
          ${this.popupData.definition ? html`<div><span class="popup-label">Definition (in ${this.nativeLanguage})</span><span class="popup-content-text">${this.popupData.definition}</span></div>` : ''}
        `}
      </div>
    `;
  }
}
