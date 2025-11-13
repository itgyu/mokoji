// Kakao Maps SDK 타입 정의
declare global {
  interface Window {
    kakao: {
      maps: {
        load: (callback: () => void) => void;
        services: {
          Status: {
            OK: string;
            ZERO_RESULT: string;
            ERROR: string;
          };
          Geocoder: new () => {
            coord2Address: (
              longitude: number,
              latitude: number,
              callback: (result: any[], status: string) => void
            ) => void;
            addressSearch: (
              address: string,
              callback: (result: any[], status: string) => void
            ) => void;
          };
        };
      };
    };
  }
}

export {};
