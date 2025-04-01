

export function parseDate(value: string): number {
    
    const now = new Date();
    let date: Date;

    switch (value) {
      case '1h':
        date = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        date = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '3d':
        date = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        break;
      case '7d':
        date = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        date = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '6m':
        date = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
        break;
      case 'now':
        date = new Date();
        break;
      default:
        date = new Date(value);
        break;
    }
    
     return Math.floor(date.getTime() / 1000);
}


