import React, { useState } from 'react';
import type { City } from '../types';
import CityCard from './CityCard';
import { Globe, Search, AlertCircle, MapPin, Target } from 'lucide-react';

interface GeocodingResult {
  display_name: string;
  lat: string;
  lon: string;
  address: any;
  type: string;
}

interface StartScreenProps {
  cities: City[];
  onSelectCity: (cityId: string, distanceMode?: boolean) => void;
  onSelectCustomCity: (city: City, distanceMode?: boolean) => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ cities, onSelectCity, onSelectCustomCity }) => {
  const [customCityName, setCustomCityName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchResults, setSearchResults] = useState<City[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [distanceMode, setDistanceMode] = useState(false);

  const searchCustomCity = async () => {
    if (!customCityName.trim()) return;
    
    setIsSearching(true);
    setSearchError('');
    setSearchResults([]);
    setShowResults(false);
    
    try {
      // Using Nominatim (OpenStreetMap) geocoding service with higher limit for disambiguation
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(customCityName)}&format=json&limit=10&addressdetails=1&accept-language=ru,en`
      );
      
      if (!response.ok) {
        throw new Error('Поиск временно недоступен');
      }
      
      const results: GeocodingResult[] = await response.json();
      
      if (results.length === 0) {
        setSearchError('Город не найден');
        return;
      }
      
      // Filter and process results to only include cities/towns/villages
      const validTypes = ['city', 'town', 'village', 'municipality', 'administrative'];
      const cityResults = results
        .filter(result => validTypes.some(type => result.type.includes(type)))
        .map((result, index) => {
          const address = result.address || {};
          const cityName = address.city || address.town || address.village || address.municipality || result.display_name.split(',')[0];
          const country = address.country || 'Unknown';
          const state = address.state || address.region || '';
          
          return {
            id: `custom_${Date.now()}_${index}`,
            name: cityName,
            country: state ? `${state}, ${country}` : country,
            latitude: parseFloat(result.lat),
            longitude: parseFloat(result.lon),
            imageUrl: "https://images.pexels.com/photos/1519088/pexels-photo-1519088.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"
          };
        })
        // Remove duplicates based on name and country
        .filter((city, index, arr) => 
          arr.findIndex(c => c.name === city.name && c.country === city.country) === index
        );
      
      if (cityResults.length === 0) {
        setSearchError('Не удалось найти ни одного города с таким названием. Попробуйте ввести другой поисковый запрос.');
        return;
      }
      
      if (cityResults.length === 1) {
        // Only one result, select it directly
        onSelectCustomCity(cityResults[0], distanceMode);
      } else {
        // Multiple results, show disambiguation
        setSearchResults(cityResults);
        setShowResults(true);
      }
      
    } catch (error) {
      console.error('Ошибка сервиса Geocoding:', error);
      setSearchError('Ошибка поиска. Попробуйте ещё раз или выберите город из списка ниже.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchCustomCity();
    }
  };

  const handleSelectSearchResult = (city: City) => {
    setShowResults(false);
    setSearchResults([]);
    setCustomCityName('');
    onSelectCustomCity(city, distanceMode);
  };

  const handleBackToSearch = () => {
    setShowResults(false);
    setSearchResults([]);
  };

  return (
    <div className="container rounded-lg mx-auto px-4 py-4">
      <div className="text-center mb-8 animate-fadeIn">
        <div className="flex justify-center mb-4">
          <Globe size={48} className="text-teal-600" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">Расстояния</h1>
        <div className="text-left text-lg text-gray-600 max-w-2xl mx-auto mt-8 mb-8 space-y-1">
          <p className="mb-0">• <b>Выберите город-базу</b> - вы можете воспользоваться списком ниже или ввести свой вариант.</p>
          <p>• <b>Вас ждёт 10 раундов.</b> В каждом из них вам надо будет определить, какой из двух городов <b>ближе</b> к городу-базе.</p>
          <p>• Также вы можете включить <b>усложнённый режим</b> - тогда вам надо будет не только отгадать, какой город ближе, но и <b>указать расстояние до него.</b></p>
          <p>• Чем точнее ваши ответы, тем больше баллов вы получаете. <b>Удачи!</b></p>
        </div>

        {/* Game Mode Selection */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Режим игры</h3>
            
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="gameMode"
                  checked={!distanceMode}
                  onChange={() => setDistanceMode(false)}
                  className="mt-3 text-teal-600 focus:ring-teal-500"
                />
                <div className="text-left">
                  <div className="font-medium text-gray-800">Классический</div>
                  <div className="text-sm text-gray-600">Выберите, какой из двух городов ближе к городу-базе, и получите <b>1000 очков</b> за правильный ответ.</div>
                </div>
              </label>
              
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="gameMode"
                  checked={distanceMode}
                  onChange={() => setDistanceMode(true)}
                  className="mt-3 text-teal-600 focus:ring-teal-500"
                />
                <div className="text-left">
                  <div className="font-medium text-gray-800 flex items-center gap-2">
                    <Target size={16} className="text-orange-500" />
                    Усложнённый
                  </div>
                  <div className="text-sm text-gray-600">
                    Выберите ближайший город, а затем отгадайте расстояние до него
                    <br />
                    <span className="text-orange-600 font-medium"><b>До 1000 очков дополнительно</b> в зависимости от точности, с которой вы сможете определить расстояние</span>
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>
        
        {/* Custom City Search */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Найти город-базу</h3>
            
            {!showResults ? (
              <>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={customCityName}
                      onChange={(e) => setCustomCityName(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Город"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      disabled={isSearching}
                    />
                  </div>
                  <button
                    onClick={searchCustomCity}
                    disabled={isSearching || !customCityName.trim()}
                    className="text-base px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    <Search size={16} />
                    {isSearching ? 'Ищем...' : 'Искать'}
                  </button>
                </div>
                
                {searchError && (
                  <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
                    <AlertCircle className="shrink-0" size={16} />
                    <div className="text-left">{searchError}</div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <h4 className="mb-0 font-medium text-gray-800">Найдено несколько вариантов. <br/>Выберите подходящий:</h4>
                
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {searchResults.map((city) => (
                    <button
                      key={city.id}
                      onClick={() => handleSelectSearchResult(city)}
                      className="w-full text-left p-3 border border-gray-200 rounded-md hover:bg-gray-50 hover:border-teal-300 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-gray-400 flex-shrink-0" />
                        <div>
                          <div className="font-medium leading-[1.5] text-gray-800">{city.name}</div>
                          <div className="text-sm text-gray-600">{city.country}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleBackToSearch}
                  className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors"
                >
                  Назад
                </button>
              </div>
            )}
          </div>
        </div>
        
        {!showResults && (
          <div className="text-center mb-6">
            <p className="text-gray-500">Или выбрать город из списка ниже:</p>
          </div>
        )}
      </div>
      
      {!showResults && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {cities.map(city => (
            <CityCard
              key={city.id}
              city={city}
              isSelectable={true}
              onClick={() => onSelectCity(city.id, distanceMode)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default StartScreen;