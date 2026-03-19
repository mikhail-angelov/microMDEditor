// DecorationLayer - renders formatted markdown using React elements
// Replaces dangerouslySetInnerHTML for better security and React integration

import React from "react";
import { Token } from "./types";
import { tokenize } from "./tokenizer";

interface DecorationLayerProps {
  text: string;
  blockType: string;
}

export function DecorationLayer({ text, blockType }: DecorationLayerProps) {
  // For code blocks, render as plain text
  if (blockType === "code") {
    return <>{text}</>;
  }

  const tokens = tokenize(text);
  
  return (
    <>
      {tokens.map((token, index) => {
        const key = `${index}-${token.type}-${token.content.substring(0, 10)}`;
        
        switch (token.type) {
          case "bold":
            return <strong key={key}>{token.content}</strong>;
          case "italic":
            return <em key={key}>{token.content}</em>;
          case "code":
            return <code className="inline-code" key={key}>{token.content}</code>;
          case "syntax":
            return <span className="md-syntax" key={key}>{token.content}</span>;
          case "heading":
            return <span className="md-heading" key={key}>{token.content}</span>;
          case "link":
            return <span className="md-link" key={key}>{token.content}</span>;
          default:
            return <span key={key}>{token.content}</span>;
        }
      })}
    </>
  );
}