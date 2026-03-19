import React from "react";
import { Token } from "./types";
import { tokenize } from "./tokenizer";

interface DecorationLayerProps {
  text: string;
  blockType: string;
}

function renderToken(token: Token, key: string) {
  switch (token.type) {
    case "bold":
      return (
        <span className="md-inline-bold" key={key}>
          {token.content}
        </span>
      );
    case "italic":
      return (
        <span className="md-inline-italic" key={key}>
          {token.content}
        </span>
      );
    case "code":
      return (
        <span className="md-inline-code" key={key}>
          {token.content}
        </span>
      );
    case "strike":
      return (
        <span className="md-inline-strike" key={key}>
          {token.content}
        </span>
      );
    case "syntax":
      return (
        <span className="md-syntax" key={key}>
          {token.content}
        </span>
      );
    case "heading":
      return (
        <span className="md-heading" key={key}>
          {token.content}
        </span>
      );
    case "link":
      return (
        <span className="md-link" key={key}>
          {token.content}
        </span>
      );
    default:
      return <span key={key}>{token.content}</span>;
  }
}

export function DecorationLayer({ text, blockType }: DecorationLayerProps) {
  if (blockType === "code") {
    return <>{text}</>;
  }

  const tokens = tokenize(text);

  return <>{tokens.map((token, index) => renderToken(token, `${index}-${token.type}`))}</>;
}
