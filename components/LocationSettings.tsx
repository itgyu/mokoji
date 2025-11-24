'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, X, Check, Loader } from 'lucide-react';
import { Button } from './ui';

declare global {
  interface Window {
    kakao: any;
  }
}

interface LocationSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (location: {
    address: string;
    dong: string;
    latitude: number;
    longitude: number;
    radius: number;
  }) => void;
  initialLocation?: {
    latitude: number;
    longitude: number;
    radius?: number;
  };
}

const RADIUS_OPTIONS = [
  { value: 500, label: '500m' },
  { value: 1000, label: '1km' },
  { value: 2000, label: '2km' },
  { value: 5000, label: '5km' },
];

export default function LocationSettings({
  isOpen,
  onClose,
  onSave,
  initialLocation,
}: LocationSettingsProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [circle, setCircle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [address, setAddress] = useState('');
  const [dong, setDong] = useState('');
  const [radius, setRadius] = useState(initialLocation?.radius || 1000);

  // 지도 초기화
  useEffect(() => {
    if (!isOpen || !mapRef.current) return;

    const initMap = () => {
      if (!window.kakao?.maps) {
        console.error('Kakao Maps SDK not loaded');
        return;
      }

      // 초기 위치 설정 (서울시청)
      const defaultLat = initialLocation?.latitude || 37.5665;
      const defaultLng = initialLocation?.longitude || 126.9780;

      const container = mapRef.current;
      const options = {
        center: new window.kakao.maps.LatLng(defaultLat, defaultLng),
        level: 4,
      };

      const newMap = new window.kakao.maps.Map(container, options);
      setMap(newMap);

      // 마커 생성
      const newMarker = new window.kakao.maps.Marker({
        position: new window.kakao.maps.LatLng(defaultLat, defaultLng),
        map: newMap,
      });
      setMarker(newMarker);

      // 반경 원 생성
      const newCircle = new window.kakao.maps.Circle({
        center: new window.kakao.maps.LatLng(defaultLat, defaultLng),
        radius: radius,
        strokeWeight: 2,
        strokeColor: '#FF9B50',
        strokeOpacity: 0.8,
        strokeStyle: 'solid',
        fillColor: '#FF9B50',
        fillOpacity: 0.2,
      });
      newCircle.setMap(newMap);
      setCircle(newCircle);

      // 주소 가져오기
      getAddress(defaultLat, defaultLng);

      // 현재 위치 가져오기
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            setCurrentLocation({ latitude: lat, longitude: lng });

            if (!initialLocation) {
              // 초기 위치가 없으면 현재 위치로 이동
              const newCenter = new window.kakao.maps.LatLng(lat, lng);
              newMap.setCenter(newCenter);
              newMarker.setPosition(newCenter);
              newCircle.setPosition(newCenter);
              getAddress(lat, lng);
            }

            setLoading(false);
          },
          (error) => {
            console.error('Geolocation error:', error);
            setLoading(false);
          }
        );
      } else {
        setLoading(false);
      }

      // 지도 클릭 이벤트
      window.kakao.maps.event.addListener(newMap, 'click', (mouseEvent: any) => {
        const latlng = mouseEvent.latLng;
        newMarker.setPosition(latlng);
        newCircle.setPosition(latlng);
        getAddress(latlng.getLat(), latlng.getLng());
      });
    };

    // Kakao Maps SDK 로드 확인
    if (window.kakao?.maps) {
      initMap();
    } else {
      const script = document.createElement('script');
      script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY}&autoload=false&libraries=services`;
      script.async = true;
      script.onload = () => {
        window.kakao.maps.load(initMap);
      };
      document.head.appendChild(script);
    }
  }, [isOpen, initialLocation]);

  // 반경 변경 시 원 업데이트
  useEffect(() => {
    if (circle) {
      circle.setRadius(radius);
    }
  }, [radius, circle]);

  // 주소 가져오기
  const getAddress = (lat: number, lng: number) => {
    if (!window.kakao?.maps?.services) return;

    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.coord2Address(lng, lat, (result: any, status: any) => {
      if (status === window.kakao.maps.services.Status.OK) {
        const addr = result[0].address;
        setAddress(addr.address_name);
        setDong(addr.region_3depth_name || addr.region_2depth_name);
      }
    });
  };

  // 현재 위치로 이동
  const handleGoToCurrentLocation = () => {
    if (currentLocation && map && marker && circle) {
      const latlng = new window.kakao.maps.LatLng(
        currentLocation.latitude,
        currentLocation.longitude
      );
      map.setCenter(latlng);
      marker.setPosition(latlng);
      circle.setPosition(latlng);
      getAddress(currentLocation.latitude, currentLocation.longitude);
    }
  };

  // 저장
  const handleSave = () => {
    if (!marker) return;

    const position = marker.getPosition();
    onSave({
      address,
      dong,
      latitude: position.getLat(),
      longitude: position.getLng(),
      radius,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-2xl sm:max-h-[90vh] flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <button onClick={onClose} className="p-2">
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold">내 동네 설정</h2>
          <button
            onClick={handleSave}
            disabled={loading || !address}
            className="p-2 text-[#FF9B50] font-bold disabled:opacity-50"
          >
            <Check className="w-5 h-5" />
          </button>
        </div>

        {/* Map */}
        <div className="relative flex-1">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
              <Loader className="w-8 h-8 text-[#FF9B50] animate-spin" />
            </div>
          )}
          <div ref={mapRef} className="w-full h-full min-h-[300px]" />

          {/* Current location button */}
          {currentLocation && (
            <button
              onClick={handleGoToCurrentLocation}
              className="absolute bottom-4 right-4 bg-white p-3 rounded-full shadow-lg hover:bg-gray-50 active:scale-95 transition-transform"
            >
              <MapPin className="w-5 h-5 text-[#FF9B50]" />
            </button>
          )}
        </div>

        {/* Info & Controls */}
        <div className="p-4 space-y-4 border-t">
          {/* Address */}
          {address && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">선택한 위치</p>
              <p className="font-bold text-base mt-1">{dong}</p>
              <p className="text-xs text-gray-500 mt-1">{address}</p>
            </div>
          )}

          {/* Radius Selector */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              동네 생활 반경
            </label>
            <div className="grid grid-cols-4 gap-2">
              {RADIUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setRadius(option.value)}
                  className={`py-3 px-4 rounded-lg font-bold text-sm transition-all ${
                    radius === option.value
                      ? 'bg-[#FF9B50] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              ※ 설정한 반경 내의 크루가 노출됩니다
            </p>
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={loading || !address}
            className="w-full py-4 bg-[#FF9B50] text-white rounded-xl font-bold hover:bg-[#FF8A3D] disabled:opacity-50"
          >
            {loading ? '위치 확인 중...' : '내 동네로 설정하기'}
          </Button>
        </div>
      </div>
    </div>
  );
}
