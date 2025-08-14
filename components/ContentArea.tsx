import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import ContentCarousel from './ContentCarousel';
import { FiLoader } from 'react-icons/fi';
import { SpotifyItem } from './PlaylistItem';
import apiClient from '../api';

// Helper for dynamic greeting
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Buongiorno";
  if (hour < 18) return "Buon pomeriggio";
  return "Buonasera";
};

interface HomeSection {
  title: string;
  items: SpotifyItem[];
}

// Main Component
const ContentArea = ({ isNight, onSelectItem, startFetching }: { isNight: boolean; onSelectItem: (item: SpotifyItem) => void; startFetching: boolean; }) => {
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [homeSections, setHomeSections] = useState<HomeSection[]>([]);

  const fetchData = useCallback(async () => {
      if (!user) return;
      setLoading(true);
      setError(null);
      setHomeSections([]); // Clear previous sections

      try {
          // Fase A: Ottenere la "Mappa" delle Categorie
          const categoriesResponse = await apiClient.get('/browse/categories?country=IT&limit=50');
          const categories = categoriesResponse.data.categories.items;

          if (!categories || categories.length === 0) {
              throw new Error("No categories found.");
          }
          
          // Fase B: Caricare le Playlist per OGNI Categoria
          const playlistPromises = categories.map(async (category: any) => {
              try {
                  const playlistsResponse = await apiClient.get(`/browse/categories/${category.id}/playlists?country=IT&limit=10`);
                  if (playlistsResponse.data.playlists.items.length > 0) {
                      return {
                          title: category.name,
                          items: playlistsResponse.data.playlists.items
                      };
                  }
                  return null; // Don't create a section if there are no playlists
              } catch (e) {
                  console.warn(`Could not fetch playlists for category: ${category.name}`, e);
                  return null; // Ignore errors for individual categories
              }
          });
          
          const settledSections = await Promise.all(playlistPromises);
          
          // Filter out nulls (from errors or empty categories)
          const validSections = settledSections.filter(Boolean) as HomeSection[];
          
          setHomeSections(validSections);

      } catch (err: any) {
          console.error('Failed to fetch dynamic home page data', err);
          setError('Could not load content. Please try again later.');
      } finally {
          setLoading(false);
      }
  }, [user]);

  useEffect(() => {
      if (user && startFetching) {
          fetchData();
      } else {
          setLoading(!startFetching);
      }
  }, [user, startFetching, fetchData]);
  
  const themeColor = isNight ? 'text-[#b3b3b3]' : 'text-zinc-600';
  const greeting = getGreeting();

  if (loading) {
      return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${themeColor}`} /></div>;
  }

  if (error) {
      return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
  }

  return (
    <div className="flex-grow overflow-y-auto pb-6 hide-scrollbar">
      <h1 className="text-3xl font-bold mb-8 px-6">{greeting}, {user?.display_name}!</h1>
      
      {/* Rendering Dinamico dei Caroselli */}
      {homeSections.map(section => (
        section.items && section.items.length > 0 && (
          <ContentCarousel 
              key={section.title}
              title={section.title} 
              items={section.items} 
              isNight={isNight} 
              onSelectItem={onSelectItem} 
              keyPrefix={section.title.replace(/\s+/g, '-').toLowerCase()} // Create a unique key prefix
          />
        )
      ))}
    </div>
  );
};

export default ContentArea;