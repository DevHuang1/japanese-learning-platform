declare module "kuromoji" {
  interface KuromojiToken {
    surface_form: string;
    reading?: string;
    basic_form?: string;
    pos?: string;
    pos_detail_1?: string;
    word_type?: string;
  }
  interface Tokenizer {
    tokenize(text: string): KuromojiToken[];
  }
  interface TokenizerBuilder {
    build(callback: (err: Error | null, tokenizer: Tokenizer) => void): void;
  }
  const kuromoji: {
    builder(options: { dicPath: string }): TokenizerBuilder;
    dictionaryBuilder(): unknown;
  };
  export default kuromoji;
}
