import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Calendar, Image as ImageIcon, ArrowRight } from 'lucide-react';

interface Event {
  eventId: string;
  eventName: string;
  eventDate: string;
  thumbnailUrl: string;
}

interface MatchingImage {
  imageId: string;
  eventId: string;
  eventName: string;
  imageUrl: string;
  matchedDate: string;
}

const AttendeeDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [attendedEvents, setAttendedEvents] = useState<Event[]>([]);
  const [matchingImages, setMatchingImages] = useState<MatchingImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userEmail = localStorage.getItem('userEmail');
        if (!userEmail) {
          navigate('/GoogleLogin');
          return;
        }

        // TODO: Replace with actual API calls
        // Fetch selfie URL
        const selfieResponse = await fetch(`/api/attendee/${userEmail}/selfie`);
        const selfieData = await selfieResponse.json();
        setSelfieUrl(selfieData.selfieUrl);

        // Fetch attended events
        const eventsResponse = await fetch(`/api/attendee/${userEmail}/events`);
        const eventsData = await eventsResponse.json();
        setAttendedEvents(eventsData.events);

        // Fetch matching images
        const imagesResponse = await fetch(`/api/attendee/${userEmail}/matching-images`);
        const imagesData = await imagesResponse.json();
        setMatchingImages(imagesData.images);

        setLoading(false);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900">Your Event Memories</h1>
          <p className="mt-2 text-gray-600">View your attended events and matched photos</p>
        </div>

        {/* Selfie Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-20 w-20 rounded-full overflow-hidden bg-gray-100">
                {selfieUrl ? (
                  <img src={selfieUrl} alt="Your selfie" className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-full w-full text-gray-400 p-4" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Your Selfie</h2>
                <p className="text-gray-600">Used for photo matching</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/upload-selfie')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Update Selfie
            </button>
          </div>
        </div>

        {/* Attended Events Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Events You've Attended</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {attendedEvents.map((event) => (
              <div
                key={event.eventId}
                className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="aspect-w-16 aspect-h-9">
                  <img
                    src={event.thumbnailUrl}
                    alt={event.eventName}
                    className="object-cover w-full h-full"
                  />
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-900">{event.eventName}</h3>
                  <p className="text-gray-600">{new Date(event.eventDate).toLocaleDateString()}</p>
                  <button
                    onClick={() => navigate(`/event/${event.eventId}`)}
                    className="mt-4 flex items-center text-blue-600 hover:text-blue-800"
                  >
                    View Event
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Matching Images Section */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Matched Photos</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {matchingImages.map((image) => (
              <div
                key={image.imageId}
                className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="aspect-square">
                  <img
                    src={image.imageUrl}
                    alt={`Matched photo from ${image.eventName}`}
                    className="object-cover w-full h-full"
                  />
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-gray-900 truncate">{image.eventName}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(image.matchedDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendeeDashboard; 