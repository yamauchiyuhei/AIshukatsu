export interface Question {
  id: string;           // "Q0", "Q1", ...
  category: string | null;
  title: string;
  html: string;
}
