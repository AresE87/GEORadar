import { describe, it, expect } from 'vitest';
import { parseMention } from './mention-parser';

describe('Mention Parser', () => {
  // MP-01: Brand with special regex chars "C++"
  it('handles brand with regex special chars (C++)', () => {
    const result = parseMention(
      'C++ is a powerful programming language used widely.',
      'C++',
      []
    );
    expect(result.brandMentioned).toBe(true);
    expect(result.mentionType).toBe('primary');
  });

  // MP-02: Brand with ampersand "Johnson & Johnson"
  it('handles brand with ampersand (Johnson & Johnson)', () => {
    const result = parseMention(
      'Johnson & Johnson is a leading healthcare company known for quality products.',
      'Johnson & Johnson',
      []
    );
    expect(result.brandMentioned).toBe(true);
  });

  // MP-03: Brand with accented characters "Café René"
  it('handles brand with accented characters', () => {
    const result = parseMention(
      'Café René is a popular coffee brand in Europe.',
      'Café René',
      []
    );
    expect(result.brandMentioned).toBe(true);
  });

  // MP-05: Brand mentioned many times
  it('handles brand mentioned 50 times without performance issues', () => {
    const repeated = Array(50).fill('HubSpot is great.').join(' ');
    const result = parseMention(repeated, 'HubSpot', []);
    expect(result.brandMentioned).toBe(true);
    expect(result.mentionType).toBe('primary');
  });

  // MP-06: Response in Spanish
  it('detects brand in Spanish response', () => {
    const result = parseMention(
      'HubSpot es una excelente herramienta de marketing digital.',
      'HubSpot',
      []
    );
    expect(result.brandMentioned).toBe(true);
    expect(result.sentiment).toBe('positive');
  });

  // MP-08: Partial mention (Hub vs HubSpot)
  it('does not match partial brand names (word boundary)', () => {
    const result = parseMention(
      'The Hub is a coworking space downtown.',
      'HubSpot',
      []
    );
    expect(result.brandMentioned).toBe(false);
    expect(result.mentionType).toBe('not_mentioned');
  });

  // HAPPY: Primary mention detection
  it('detects primary mention when brand is #1 in list', () => {
    const response = `Here are the best tools:
1. HubSpot - great for marketing
2. Salesforce - good CRM
3. Marketo - email automation`;
    const result = parseMention(response, 'HubSpot', ['Salesforce', 'Marketo']);
    expect(result.brandMentioned).toBe(true);
    expect(result.mentionType).toBe('primary');
    expect(result.mentionPosition).toBe(1);
    expect(result.competitorsMentioned).toContain('Salesforce');
    expect(result.competitorsMentioned).toContain('Marketo');
  });

  // HAPPY: Secondary mention
  it('detects secondary mention when brand is not first', () => {
    const response = `Here are the best tools:
1. Salesforce - best CRM
2. Marketo - email
3. HubSpot - good option`;
    const result = parseMention(response, 'HubSpot', ['Salesforce']);
    expect(result.brandMentioned).toBe(true);
    expect(result.mentionType).toBe('secondary');
    expect(result.mentionPosition).toBe(3);
  });

  // HAPPY: Not mentioned at all
  it('returns not_mentioned when brand is absent', () => {
    const result = parseMention(
      'Salesforce and Marketo are great CRM tools for businesses.',
      'HubSpot',
      ['Salesforce', 'Marketo']
    );
    expect(result.brandMentioned).toBe(false);
    expect(result.mentionType).toBe('not_mentioned');
    expect(result.mentionPosition).toBeNull();
    expect(result.competitorsMentioned).toContain('Salesforce');
  });

  // HAPPY: Case-insensitive detection
  it('detects brand case-insensitively', () => {
    const result = parseMention(
      'hubspot is a recommended marketing platform',
      'HubSpot',
      []
    );
    expect(result.brandMentioned).toBe(true);
  });

  // NEGATIVE: Negative sentiment detection
  it('detects negative mention', () => {
    const result = parseMention(
      'I would not recommend HubSpot for small businesses due to limitations.',
      'HubSpot',
      []
    );
    expect(result.brandMentioned).toBe(true);
    expect(result.mentionType).toBe('negative');
    expect(result.sentiment).toBe('negative');
  });

  // ERROR: Empty response
  it('handles empty response without error', () => {
    const result = parseMention('', 'HubSpot', []);
    expect(result.brandMentioned).toBe(false);
    expect(result.mentionType).toBe('not_mentioned');
    expect(result.sentiment).toBe('neutral');
  });

  // ERROR: Empty brand name
  it('handles empty brand name without error', () => {
    const result = parseMention('Some response text', '', []);
    expect(result.brandMentioned).toBe(false);
    expect(result.mentionType).toBe('not_mentioned');
  });

  // EDGE: Competitor detection
  it('detects competitors correctly', () => {
    const result = parseMention(
      'Consider Salesforce, Zoho, or Pipedrive for CRM needs.',
      'HubSpot',
      ['Salesforce', 'Zoho', 'Pipedrive']
    );
    expect(result.brandMentioned).toBe(false);
    expect(result.competitorsMentioned).toEqual(['Salesforce', 'Zoho', 'Pipedrive']);
  });

  // EDGE: Positive sentiment
  it('detects positive sentiment correctly', () => {
    const result = parseMention(
      'HubSpot is an excellent and trusted platform, the top choice for marketing.',
      'HubSpot',
      []
    );
    expect(result.brandMentioned).toBe(true);
    expect(result.sentiment).toBe('positive');
  });
});
