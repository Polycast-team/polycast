import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ReadyState } from 'react-use-websocket';
import Controls from './Controls';

describe('Controls component', () => {
  const mockOnStartRecording = vi.fn();
  const mockOnStopRecording = vi.fn();

  const defaultProps = {
    readyState: ReadyState.OPEN,
    isRecording: false,
    onStartRecording: mockOnStartRecording,
    onStopRecording: mockOnStopRecording,
  };

  it('renders buttons and dropdown', () => {
    render(<Controls {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Start Recording/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Stop Recording/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument(); // Assuming select is a combobox
  });

  it('enables Start button only when connected and not recording', () => {
    const { rerender } = render(<Controls {...defaultProps} readyState={ReadyState.CONNECTING} />);
    expect(screen.getByRole('button', { name: /Start Recording/i })).toBeDisabled();

    rerender(<Controls {...defaultProps} readyState={ReadyState.OPEN} />);
    expect(screen.getByRole('button', { name: /Start Recording/i })).toBeEnabled();

    rerender(<Controls {...defaultProps} readyState={ReadyState.OPEN} isRecording={true} />);
    expect(screen.getByRole('button', { name: /Start Recording/i })).toBeDisabled();
  });

  it('enables Stop button only when recording', () => {
    const { rerender } = render(<Controls {...defaultProps} isRecording={false} />);
    expect(screen.getByRole('button', { name: /Stop Recording/i })).toBeDisabled();

    rerender(<Controls {...defaultProps} isRecording={true} />);
    expect(screen.getByRole('button', { name: /Stop Recording/i })).toBeEnabled();
  });

  it('calls onStartRecording when Start button is clicked', () => {
    render(<Controls {...defaultProps} readyState={ReadyState.OPEN} isRecording={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Start Recording/i }));
    expect(mockOnStartRecording).toHaveBeenCalledTimes(1);
  });

  it('calls onStopRecording when Stop button is clicked', () => {
    render(<Controls {...defaultProps} readyState={ReadyState.OPEN} isRecording={true} />);
    fireEvent.click(screen.getByRole('button', { name: /Stop Recording/i }));
    expect(mockOnStopRecording).toHaveBeenCalledTimes(1);
  });
});
