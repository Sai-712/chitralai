import React, { useState, useEffect, useRef, useContext } from 'react';
import { Menu, X, Upload, Camera, LogIn, LogOut, User, MessageSquare, Phone, Mail, AlertCircle, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { storeUserCredentials, getUserByEmail, queryUserByEmail } from '../config/dynamodb';
import { UserContext } from '../App';

interface NavbarProps {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  showSignInModal: boolean;
  setShowSignInModal: (show: boolean) => void;
}

interface DecodedToken {
  exp: number;
  name: string;
  email: string;
  picture: string;
  sub: string;
}

interface UserProfile {
  name: string;
  email: string;
  picture: string;
  mobile: string;
}

const Navbar: React.FC<NavbarProps> = ({ 
  mobileMenuOpen, 
  setMobileMenuOpen,
  showSignInModal,
  setShowSignInModal 
}) => {
  const { userEmail, userRole, setUserEmail, setUserRole } = useContext(UserContext);
  const [isLoggedIn, setIsLoggedIn] = useState(!!userEmail);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [signInForm, setSignInForm] = useState({
    name: '',
    mobile: ''
  });
  const [contactForm, setContactForm] = useState({
    fullName: '',
    email: '',
    mobile: '',
    useCase: '',
    message: ''
  });
  const [formErrors, setFormErrors] = useState({
    name: '',
    mobile: ''
  });
  const [showSignInError, setSignInError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<UserProfile | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('googleToken');
    const storedProfile = localStorage.getItem('userProfile');
    
    if (token && storedProfile) {
      try {
        const decoded = jwtDecode<DecodedToken>(token);
        const exp = decoded.exp * 1000; // Convert to milliseconds
        
        if (exp > Date.now()) {
          setIsLoggedIn(true);
          setUserProfile(JSON.parse(storedProfile));
          setUserEmail(decoded.email);
          
          // Check user role from DynamoDB using both methods
          const checkUserRole = async () => {
            try {
              // First try with getUserByEmail
              let user = await getUserByEmail(decoded.email);
              console.log('getUserByEmail result:', user);
              
              // If that fails, try with queryUserByEmail
              if (!user) {
                console.log('getUserByEmail returned null, trying queryUserByEmail');
                user = await queryUserByEmail(decoded.email);
                console.log('queryUserByEmail result:', user);
              }
              
              if (user && user.role) {
                console.log('User role found:', user.role);
                setUserRole(user.role);
              } else {
                console.log('No user role found for email:', decoded.email);
                // Set a consistent role of 'organizer' if no role is found
                setUserRole('organizer');
                
                // Optionally, create/update the user record to include a role
                try {
                  const mobileNumber = localStorage.getItem('userMobile') || '';
                  await storeUserCredentials({
                    userId: decoded.email,
                    email: decoded.email,
                    name: JSON.parse(storedProfile).name || '',
                    mobile: mobileNumber,
                    role: 'organizer'
                  });
                  console.log('Added default user role to database');
                } catch (err) {
                  console.error('Error adding default user role:', err);
                }
              }
            } catch (error) {
              console.error('Error fetching user role:', error);
              // Set a default role as fallback
              setUserRole('user');
            }
          };
          
          checkUserRole();
        } else {
          handleLogout();
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        handleLogout();
      }
    }
  }, [setUserEmail, setUserRole]);

  const handleSignIn = async (credentialResponse: CredentialResponse) => {
    try {
      const credential = credentialResponse.credential;
      if (!credential) throw new Error('No credential received');

      const decoded: any = jwtDecode(credential);
      if (!decoded) throw new Error('Unable to decode credentials');

      const name = decoded.name;
      const email = decoded.email;
      const picture = decoded.picture;

      // Set form state
      setSignInForm({
        ...signInForm,
        name: name || '',
      });

      // Check if there was a pending action before login
      const pendingAction = localStorage.getItem('pendingAction');
      const role = pendingAction === 'createEvent' ? 'organizer' : 'user';

      // Store user in DynamoDB
      const userData = {
        userId: email, // Using email as userId for simplicity
        email: email,
        name: name || '',
        mobile: signInForm.mobile || '',
        role: role
      };
      
      await storeUserCredentials(userData);

      // Store essential user data in localStorage for session management
      localStorage.setItem('userEmail', decoded.email);
      localStorage.setItem('userMobile', signInForm.mobile || '');
      
      // We keep these in localStorage for now for backward compatibility
      localStorage.setItem('googleToken', credentialResponse.credential);
      localStorage.setItem('userProfile', JSON.stringify({
        name,
        email,
        picture
      }));

      setShowSignInModal(false);
      setUserProfile({
        name,
        email,
        picture,
        mobile: signInForm.mobile || ''
      });
      setUserEmail(email);
      setIsLoggedIn(true);
      setUserRole(role);

      if (pendingAction) {
        localStorage.removeItem('pendingAction');
        if (pendingAction === 'createEvent') {
          navigate('/events?create=true');
        }
      }
    } catch (error) {
      console.error('Error in sign in process:', error);
      setSignInError('Failed to sign in. Please try again.');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserProfile(null);
    setUserRole(null);
    setUserEmail(null);
    localStorage.removeItem('googleToken');
    localStorage.removeItem('userProfile');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userMobile');
    localStorage.removeItem('pendingAction');
  };

  const validateForm = () => {
    let isValid = true;
    const errors = {
      name: '',
      mobile: ''
    };

    if (!signInForm.name.trim()) {
      errors.name = 'Name is required';
      isValid = false;
    }

    if (!signInForm.mobile.trim()) {
      errors.mobile = 'Mobile number is required';
      isValid = false;
    } else if (!/^[0-9]{10}$/.test(signInForm.mobile.trim())) {
      errors.mobile = 'Please enter a valid 10-digit mobile number';
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const isFormValid = signInForm.name.trim() !== '' && /^[0-9]{10}$/.test(signInForm.mobile.trim());

  const handleSignOut = async () => {
    // Clear user data from localStorage
    localStorage.removeItem('googleToken');
    localStorage.removeItem('userProfile');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userMobile');
    localStorage.removeItem('pendingAction');
    
    setUserInfo(null);
    setIsUserMenuOpen(false);
    
    // Redirect to home page
    navigate('/');
  };

  return (              
    <header className="bg-white sticky top-0 z-50 shadow-2xl transition-all duration-300 rounded-b-2xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between p-4 sm:p-4 lg:px-8 relative" aria-label="Global">
        <div className="flex-1 flex items-center">
          <Link to="/" className="flex items-center transform transition-all duration-300 hover:scale-105 -ml-8">
            <img src="/chitralai.jpeg" alt="Chitralai Logo" className="h-12 w-auto" />
          </Link>
        </div>
        <div className="flex lg:hidden">
          <button
            type="button"
            className="-m-2.5 inline-flex items-center justify-center rounded-full p-2.5 text-blue-600 hover:text-blue-800 transition-colors duration-300"
            onClick={() => setMobileMenuOpen(true)}
          >
            <span className="sr-only">Open main menu</span>
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        <div className="hidden lg:flex lg:gap-x-12">
          {!isLoggedIn && (
            <>
            </>
          )}
        </div>
        <div className="hidden lg:flex lg:flex-1 lg:justify-end">
          {!isLoggedIn ? (
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowContactModal(true)}
                className="text-blue-600 hover:text-blue-800 transition-all duration-300 hover:scale-105 px-4 py-2 rounded-full hover:bg-blue-50"
              >
                Get in Touch
              </button>
              <button
                onClick={() => setShowSignInModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 shadow-sm"
              >
                <LogIn className="h-4 w-4" />
                Sign In
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              {/* Debug display for development */}
              {/*<div className="text-xs text-gray-500">Role: {userRole || 'none'}</div>*/}
              
              {/* Conditional navigation based on user role */}
              <Link to="/events" className="text-sm font-semibold leading-6 text-blue-600 hover:text-blue-800 transition-all duration-300 hover:scale-105 px-4 py-2 rounded-full hover:bg-blue-50 flex items-center">
                <User className="h-4 w-4 mr-1" />Events
              </Link>
              
             {/* {userRole !== 'organizer' && (
                <Link to="/attendee-dashboard" className="text-sm font-semibold leading-6 text-blue-600 hover:text-blue-800 transition-all duration-300 hover:scale-105 px-4 py-2 rounded-full hover:bg-blue-50 flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />My Photos
                </Link>
             )}*/}
              
              <Link to="/upload" className="text-sm font-semibold leading-6 text-blue-600 hover:text-blue-800 transition-all duration-300 hover:scale-105 px-4 py-2 rounded-full hover:bg-blue-50 flex items-center">
                <Upload className="h-4 w-4 mr-1" /> Uploaded Images
              </Link>
              
              <button
                onClick={handleLogout}
                className="text-sm font-semibold leading-6 text-blue-600 hover:text-blue-800 transition-all duration-300 hover:scale-105 px-4 py-2 rounded-full hover:bg-blue-50 flex items-center"
              >
                <LogOut className="h-4 w-4 mr-1" /> Logout
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile menu */}
      <div className={`lg:hidden ${mobileMenuOpen ? 'fixed inset-0 z-50' : 'hidden'}`}>
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white px-4 py-4 sm:px-6 sm:py-6 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10 transform transition-transform duration-300 ease-in-out">
          <div className="flex items-center justify-between mb-4">
            <Link to="/" className="flex items-center -ml-4">
              <img src="/chitralai.jpeg" alt="Chitralai Logo" className="h-12 w-auto" />
            </Link>
            <button
              type="button"
              className="rounded-full p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors duration-300"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className="sr-only">Close menu</span>
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-6 flow-root">
            <div className="-my-6 divide-y divide-gray-500/10">
              <div className="space-y-2 py-6">
                {!isLoggedIn && (
                  <>
                    <a
                      href="#features"
                      className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Features
                    </a>
                    <a
                      href="#testimonials"
                      className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Testimonials
                    </a>
                    <a
                      href="#faq"
                      className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      FAQ
                    </a>
                    <a
                      href="#get-in-touch"
                      className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Get in Touch
                    </a>
                  </>
                )}
                {isLoggedIn && (
                  <>
                    <Link
                      to="/events"
                      className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-blue-600 hover:text-blue-800 hover:bg-blue-50 flex items-center"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <User className="h-5 w-5 mr-2" /> Events
                    </Link>
                    
                  {/* {userRole !== 'organizer' && (
                      <Link
                        to="/attendee-dashboard"
                        className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-blue-600 hover:text-blue-800 hover:bg-blue-50 flex items-center"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Calendar className="h-5 w-5 mr-2" /> My Photos
                      </Link>
                    )} */}
                    
                    <Link
                      to="/upload"
                      className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-blue-600 hover:text-blue-800 hover:bg-blue-50 flex items-center"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Upload className="h-5 w-5 mr-2" /> Uploaded Images
                    </Link>
                  </>
                )}
              </div>
              <div className="py-6">
                {!isLoggedIn ? (
                  <div className="space-y-4">
                    <GoogleLogin onSuccess={handleSignIn} onError={(error) => {
                      console.error('Google Login Error:', error);
                      setSignInError('Failed to sign in. Please try again.');
                    }} />
                  </div>
                ) : (
                  <button
                    onClick={handleSignOut}
                    className="-mx-3 block rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-blue-600 hover:text-blue-800 hover:bg-blue-50 w-full text-left flex items-center"
                  >
                    <LogOut className="h-5 w-5 mr-2" /> Logout
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Sign In Modal */}
      {showSignInModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" onClick={() => setShowSignInModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Sign In</h2>
                <button
                  onClick={() => setShowSignInModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    placeholder="Enter your name"
                    className={`w-full px-3 py-2 border ${formErrors.name ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    value={signInForm.name}
                    onChange={(e) => {
                      setSignInForm({...signInForm, name: e.target.value});
                      if (formErrors.name) {
                        setFormErrors({...formErrors, name: ''});
                      }
                    }}
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-sm text-red-500 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {formErrors.name}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="mobile" className="block text-sm font-medium text-gray-700 mb-1">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      defaultValue="+91"
                    >
                      <option value="+91">+91</option>
                    </select>
                    <input
                      type="tel"
                      id="mobile"
                      placeholder="Enter 10-digit mobile number"
                      className={`flex-1 px-3 py-2 border ${formErrors.mobile ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      value={signInForm.mobile}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setSignInForm({...signInForm, mobile: value});
                        if (formErrors.mobile) {
                          setFormErrors({...formErrors, mobile: ''});
                        }
                      }}
                    />
                  </div>
                  {formErrors.mobile && (
                    <p className="mt-1 text-sm text-red-500 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {formErrors.mobile}
                    </p>
                  )}
                </div>
                <div className="mt-4">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">Continue with</span>
                    </div>
                  </div>
                  <div className={`mt-4 ${!isFormValid ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {isFormValid ? (
                      <GoogleLogin onSuccess={handleSignIn} onError={(error) => {
                        console.error('Google Login Error:', error);
                        setSignInError('Failed to sign in. Please try again.');
                      }} />
                    ) : (
                      <div className="text-center text-sm text-gray-500 mt-2">
                        Please fill in all required fields to continue
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" onClick={() => setShowContactModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Get in Touch</h2>
                <button
                  onClick={() => setShowContactModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">Fill this form or</p>
              <div className="flex gap-4 mb-6">
                <a href="https://wa.me/" className="flex items-center justify-center p-2 rounded-full bg-green-500 text-white hover:bg-green-600">
                  <MessageSquare className="h-5 w-5" />
                </a>
                <a href="mailto:" className="flex items-center justify-center p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600">
                  <Mail className="h-5 w-5" />
                </a>
                <a href="tel:" className="flex items-center justify-center p-2 rounded-full bg-purple-500 text-white hover:bg-purple-600">
                  <Phone className="h-5 w-5" />
                </a>
              </div>
              <form className="space-y-4">
                <div>
                  <input
                    type="text"
                    placeholder="Full Name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={contactForm.fullName}
                    onChange={(e) => setContactForm({...contactForm, fullName: e.target.value})}
                  />
                </div>
                <div>
                  <input
                    type="email"
                    placeholder="Email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({...contactForm, email: e.target.value})}
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    defaultValue="+91"
                  >
                    <option value="+91">+91</option>
                  </select>
                  <input
                    type="tel"
                    placeholder="Mobile"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={contactForm.mobile}
                    onChange={(e) => setContactForm({...contactForm, mobile: e.target.value})}
                  />
                </div>
                <div>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={contactForm.useCase}
                    onChange={(e) => setContactForm({...contactForm, useCase: e.target.value})}
                  >
                    <option value="">Select Use Case</option>
                    <option value="wedding">Wedding</option>
                    <option value="corporate">Corporate Event</option>
                    <option value="birthday">Birthday Party</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <textarea
                    placeholder="Type you message"
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={contactForm.message}
                    onChange={(e) => setContactForm({...contactForm, message: e.target.value})}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-300"
                >
                  Submit Now
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;