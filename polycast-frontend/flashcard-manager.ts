import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Flashcard } from './types.js';

@customElement('flashcard-manager')
export class FlashcardManager extends LitElement {
  @property({ attribute: false }) flashcards: Flashcard[] = [];
  @property({ attribute: false }) flashcardQueue: string[] = [];
  @property({ type: Number }) currentIndex = 0;
  @property({ attribute: false }) flipState: Map<string, boolean> = new Map();
  @property({ attribute: false }) intervals: Map<string, number> = new Map();
  @property({ type: String }) targetLanguage = '';

  static styles = css`
    .flashcards-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #8a80a5;
      font-size: 1.1em;
    }
    .flashcard-viewer {
      perspective: 1000px;
    }
    .flashcard-container {
      width: 340px;
      height: 200px;
      transition: transform 0.6s;
      transform-style: preserve-3d;
      position: relative;
    }
    .flashcard-container.flipped {
      transform: rotateY(180deg);
    }
    .flashcard {
      position: absolute;
      width: 100%;
      height: 100%;
      backface-visibility: hidden;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      box-sizing: border-box;
      background-color: #3c3152;
      color: #e0e0e0;
    }
    .card-back {
      transform: rotateY(180deg);
    }
  `;

  private flip(cardId: string) {
    const state = this.flipState.get(cardId) ?? false;
    this.flipState.set(cardId, !state);
    this.requestUpdate();
  }

  render() {
    const currentId = this.flashcardQueue[this.currentIndex];
    const card = this.flashcards.find(fc => fc.id === currentId);
    const flipped = currentId ? this.flipState.get(currentId) === true : false;
    return html`
      <div class="flashcards-content">
        ${!card ? html`<p class="no-flashcards-message">No cards</p>` : html`
          <div class="flashcard-viewer" @click=${() => currentId && this.flip(currentId)}>
            <div class="flashcard-container ${flipped ? 'flipped' : ''}">
              <div class="flashcard card-front">
                ${card.exampleSentences[0]?.english || ''}
              </div>
              <div class="flashcard card-back">
                ${card.exampleSentences[0]?.portugueseTranslation || ''}
              </div>
            </div>
          </div>
          <div class="flashcard-nav">
            <button @click=${() => this.dispatchEvent(new CustomEvent('prev-card', { bubbles: true, composed: true }))}>◄</button>
            <span class="card-count">${this.currentIndex + 1}/${this.flashcardQueue.length}</span>
            <button @click=${() => this.dispatchEvent(new CustomEvent('next-card', { bubbles: true, composed: true }))}>►</button>
          </div>
          <div class="flashcard-actions">
            <button @click=${() => this.dispatchEvent(new CustomEvent('answer-card', { detail: { correct: false }, bubbles: true, composed: true }))}>Incorrect</button>
            <button @click=${() => this.dispatchEvent(new CustomEvent('answer-card', { detail: { correct: true }, bubbles: true, composed: true }))}>Correct</button>
          </div>
        `}
      </div>
    `;
  }
}
