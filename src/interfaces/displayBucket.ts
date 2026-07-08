export interface DisplayBucket {
  calendarId: string;
  label: string;
  categories: string[];
  colors: {
    light: { main: string; container: string; onContainer: string };
    dark: { main: string; container: string; onContainer: string };
  };
}
