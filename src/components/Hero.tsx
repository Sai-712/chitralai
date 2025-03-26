import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Camera, Users, Shield, Zap, Clock, Image, Share2, ChevronDown, ChevronUp, CheckCircle, Lock } from 'lucide-react';
import HowItWorks from './HowItWorks';
import { storeUserCredentials, getUserByEmail } from '../config/dynamodb';
import { jwtDecode as jwt_decode } from 'jwt-decode';

interface HeroProps {
  onShowSignIn: () => void;
}

const Hero: React.FC<HeroProps> = ({ onShowSignIn }) => {
  const navigate = useNavigate();
  const [showImage, setShowImage] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const handleCreateEvent = async () => {
    const userEmail = localStorage.getItem('userEmail');
    const token = localStorage.getItem('googleToken');
    
    if (!userEmail || !token) {
      // If user is not signed in, show sign-in modal and set pendingAction
      console.log('User not signed in, showing sign-in modal and setting pendingAction');
      
      // Store in local storage that they wanted to create an event
      // This will be checked after successful login
      localStorage.setItem('pendingAction', 'createEvent');
      onShowSignIn();
    } else {
      try {
        // User is already signed in, set their role as organizer
        const decoded = jwt_decode<any>(token);
        console.log('User already signed in, setting organizer role and navigating to events');
        
        // First, check current user data to see role
        try {
          const existingUser = await getUserByEmail(decoded.email);
          console.log('Current user data before update:', existingUser);
        } catch (checkError) {
          console.error('Error checking existing user:', checkError);
        }
        
        // Update user role to organizer
        const updateResult = await storeUserCredentials({
          userId: decoded.email,
          email: decoded.email,
          name: decoded.name,
          mobile: localStorage.getItem('userMobile') || '',
          role: "organizer" 
        });
        
        if (updateResult) {
          console.log('Successfully updated user role to organizer');
          
          // Verify the update
          try {
            const updatedUser = await getUserByEmail(decoded.email);
            console.log('User data after update:', updatedUser);
          } catch (verifyError) {
            console.error('Error verifying user update:', verifyError);
          }
        } else {
          console.error('Failed to update user role');
        }
        
        // Navigate to events dashboard with create parameter to open modal
        navigate('/events?create=true');
      } catch (error) {
        console.error('Error updating user role:', error);
        navigate('/events?create=true');
      }
    }
  };

  const handleGetPhotos = () => {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
      onShowSignIn();
    } else {
      navigate('/upload-selfie');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowImage(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const features = [
    {
      icon: <Camera className="w-6 h-6 text-blue-600" />,
      title: "Smart Photo Recognition",
      description: "Advanced face recognition to find your photos in event galleries"
    },
    {
      icon: <Shield className="w-6 h-6 text-blue-600" />,
      title: "Privacy First",
      description: "Secure and private photo sharing with controlled access"
    },
    {
      icon: <Zap className="w-6 h-6 text-blue-600" />,
      title: "Instant Access",
      description: "Quick and easy access to your event memories"
    },
    {
      icon: <Share2 className="w-6 h-6 text-blue-600" />,
      title: "Easy Sharing",
      description: "Share event photos with attendees seamlessly"
    }
  ];

  const useCases = [
    {
      icon: <Users className="w-12 h-12 text-blue-600" />,
      title: "Corporate Events",
      description: "Perfect for conferences, team buildings, and company celebrations"
    },
    {
      icon: <Image className="w-12 h-12 text-blue-600" />,
      title: "Weddings",
      description: "Share precious moments with all wedding guests"
    },
    {
      icon: <Clock className="w-12 h-12 text-blue-600" />,
      title: "School Events",
      description: "Graduations, sports days, and school celebrations"
    }
  ];

 

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <div className="relative isolate overflow-hidden bg-gradient-to-b from-white to-blue-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-8 pt-4 sm:pb-12 lg:flex lg:px-8 lg:py-16">
          {/* Left Content */}
          <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-xl lg:flex-shrink-0 lg:pt-8">
            <div className="mt-4 sm:mt-8 lg:mt-8">
              <p className="text-xs sm:text-sm font-medium text-blue-600">
                Share event photos using Face Recognition
              </p>
            </div>
            <h1 className="mt-6 sm:mt-10 text-3xl sm:text-4xl lg:text-6xl font-bold tracking-tight text-gray-900">
              Most powerful photo sharing platform
            </h1>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-7 sm:leading-8 text-gray-600">
              We have a solution for all your requirements
            </p>
            <div className="mt-6 sm:mt-10 flex items-center gap-x-4 sm:gap-x-6">
              <button
                onClick={handleCreateEvent}
                className="rounded-md bg-blue-500 px-3 py-2 sm:px-3.5 sm:py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Create New Event
              </button>
             {/*<button
                onClick={handleGetPhotos}
                className="rounded-md bg-white px-3 py-2 sm:px-3.5 sm:py-2.5 text-sm font-semibold text-blue-500 shadow-sm hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 border border-blue-500"
              >
                Get Your Photos
              </button> */}
            </div>

            {/* Stats Section */}
            <div className="mt-8 sm:mt-16 grid grid-cols-2 gap-4 sm:gap-8">
              <div className="flex items-center gap-x-2">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-blue-100">
                  <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">99.3%</p>
                  <p className="text-xs sm:text-sm text-gray-600">Accuracy</p>
                </div>
              </div>
              <div className="flex items-center gap-x-2">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-blue-100">
                  <Lock className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">100%</p>
                  <p className="text-xs sm:text-sm text-gray-600">Secure</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Content - Mobile Display */}
          {showImage && (
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1 }}
              className="mx-auto mt-8 sm:mt-16 lg:ml-10 lg:mr-0 lg:mt-0 xl:ml-32 relative w-[280px] sm:w-[320px] h-[560px] sm:h-[640px] bg-black rounded-[2rem] sm:rounded-[3rem] border-[12px] sm:border-[14px] border-black overflow-hidden shadow-xl"
            >
              <div className="absolute top-0 w-full h-4 sm:h-6 bg-black z-10 flex justify-center">
                <div className="w-16 sm:w-20 h-3 sm:h-4 bg-black rounded-b-xl sm:rounded-b-2xl"></div>
              </div>
              <div className="h-full w-full overflow-y-auto bg-white grid grid-cols-2 gap-1 sm:gap-2 p-1 sm:p-2">
                {[
                  { src: 'https://i0.wp.com/josiahandsteph.com/wp-content/uploads/2021/06/An-Elegant-Pen-Ryn-Estate-Wedding-in-Bensalem-PA-Sam-Lexi-0079-scaled.jpg?w=1920', title: 'Wedding Celebration' },
                  { src: 'https://offloadmedia.feverup.com/secretmumbai.com/wp-content/uploads/2024/10/22180638/Birthday-ideas-Freepik-1024x683.jpg', title: 'Birthday Party' },
                  { src: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR_8eZYDeRpNHeeAdLukfZxHC5T9s9DVIphZQ&s', title: 'Corporate Event' },
                  { src: 'https://i0.wp.com/josiahandsteph.com/wp-content/uploads/2021/06/An-Elegant-Pen-Ryn-Estate-Wedding-in-Bensalem-PA-Sam-Lexi-0079-scaled.jpg?w=1920', title: 'Wedding Celebration' },
                  { src: 'https://offloadmedia.feverup.com/secretmumbai.com/wp-content/uploads/2024/10/22180638/Birthday-ideas-Freepik-1024x683.jpg', title: 'Birthday Party' },
                  { src: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR_8eZYDeRpNHeeAdLukfZxHC5T9s9DVIphZQ&s', title: 'Corporate Event' }
                ].map((image, index) => (
                  <motion.div
                    key={index}
                    whileHover={{ scale: 1.05 }}
                    className="relative aspect-square overflow-hidden rounded-lg shadow-md"
                  >
                    <img
                      src={image.src}
                      alt={image.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2">
                      <p className="text-white text-xs font-medium truncate">{image.title}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>

     

      {/* Features Section */}
      <div className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-blue-600">Features</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need for event photo sharing
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-4">
              {features.map((feature, index) => (
                <div key={index} className="flex flex-col">
                  <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                    {feature.icon}
                    {feature.title}
                  </dt>
                  <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                    <p className="flex-auto">{feature.description}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* Use Cases Section */}
      <div className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-blue-600">Use Cases</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Perfect for any event
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              {useCases.map((useCase, index) => (
                <div key={index} className="flex flex-col items-center text-center">
                  <dt className="mb-6">
                    {useCase.icon}
                  </dt>
                  <dd className="flex flex-auto flex-col">
                    <p className="text-xl font-semibold text-gray-900">{useCase.title}</p>
                    <p className="mt-2 text-base text-gray-600">{useCase.description}</p>
                  </dd>
                </div>
              ))}
            

      
            
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
