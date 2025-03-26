import React, { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, Image, Video, Users, Plus, X, Trash2 } from 'lucide-react';
import shortid from 'shortid';
import { 
    storeEventData, 
    getEventStatistics, 
    getUserEvents, 
    EventData, 
    deleteEvent, 
    getEventsByOrganizerId,
    getEventsByUserId
} from '../config/eventStorage';
import { s3Client, S3_BUCKET_NAME } from '../config/aws';
import { Upload } from '@aws-sdk/lib-storage';
import { UserContext } from '../App';
import { storeUserCredentials, getUserByEmail } from '../config/dynamodb';

interface Event {
    id: string;
    name: string;
    date: string;
    description?: string;
    coverImage?: File;
}

interface StatsCardProps {
    icon: React.ReactNode;
    title: string;
    count: number;
    bgColor: string;
    className?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ icon, title, count, bgColor, className }) => (
    <div className={`${bgColor} p-2 sm:p-6 rounded-lg shadow-md flex items-center space-x-1.5 sm:space-x-4 ${className || ''}`}>
        <div className="p-1.5 sm:p-3 bg-white rounded-full">{icon}</div>
        <div>
            <h3 className="text-xs sm:text-xl font-semibold text-blue-900">{title}</h3>
            <p className="text-sm sm:text-2xl font-bold text-blue-900">{count}</p>
        </div>
    </div>
);

interface EventDashboardProps {
    setShowNavbar: (show: boolean) => void;
}

const EventDashboard = (props: EventDashboardProps) => {
    const navigate = useNavigate();
    const { userEmail, userRole, setUserRole } = useContext(UserContext);
    const [deleteConfirmation, setDeleteConfirmation] = useState<{isOpen: boolean; eventId: string; userEmail: string}>({isOpen: false, eventId: '', userEmail: ''});

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newEvent, setNewEvent] = useState<Event>({ id: '', name: '', date: '' });
    const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);

    const [stats, setStats] = useState({ eventCount: 0, photoCount: 0, videoCount: 0, guestCount: 0 });
    const [isLoading, setIsLoading] = useState(false);
    const [events, setEvents] = useState<EventData[]>([]);
    const [showAllEvents, setShowAllEvents] = useState(true);

    useEffect(() => {
        loadEvents();

        // Check URL query parameters for 'create=true'
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('create') === 'true') {
            // Update user role to organizer when directed to create event
            const updateUserRole = async () => {
                try {
                    const email = localStorage.getItem('userEmail');
                    if (email) {
                        // Get user info from localStorage
                        let name = '';
                        const userProfileStr = localStorage.getItem('userProfile');
                        if (userProfileStr) {
                            try {
                                const userProfile = JSON.parse(userProfileStr);
                                name = userProfile.name || '';
                            } catch (e) {
                                console.error('Error parsing user profile from localStorage', e);
                            }
                        }
                        
                        const mobile = localStorage.getItem('userMobile') || '';
                        
                        // Update user role to organizer
                        await storeUserCredentials({
                            userId: email,
                            email,
                            name,
                            mobile,
                            role: 'organizer'
                        });
                        
                        // Update local context
                        setUserRole('organizer');
                        console.log('User role updated to organizer via URL parameter');
                    }
                } catch (error) {
                    console.error('Error updating user role via URL parameter:', error);
                }
            };
            
            updateUserRole();
            setIsModalOpen(true);
            // Remove the parameter from URL without refreshing
            navigate('/events', { replace: true });
        }
    }, [navigate, setUserRole]);

    const loadEvents = async () => {
        try {
            const userEmail = localStorage.getItem('userEmail');
            if (!userEmail) {
                console.error('User email not found');
                return;
            }
            
            console.log('Loading events for user:', userEmail);
            
            // Get events where user is listed as userEmail (backward compatibility)
            const userEvents = await getUserEvents(userEmail);
            
            // Get events where user is the organizer
            const organizerEvents = await getEventsByOrganizerId(userEmail);
            
            // Get events where user is the userId
            const userIdEvents = await getEventsByUserId(userEmail);
            
            // Combine events and remove duplicates (based on eventId)
            const allEvents = [...userEvents];
            
            // Add organizer events that aren't already in the list
            organizerEvents.forEach(orgEvent => {
                if (!allEvents.some(event => event.id === orgEvent.id)) {
                    allEvents.push(orgEvent);
                }
            });
            
            // Add userId events that aren't already in the list
            userIdEvents.forEach(userIdEvent => {
                if (!allEvents.some(event => event.id === userIdEvent.id)) {
                    allEvents.push(userIdEvent);
                }
            });
            
            if (Array.isArray(allEvents)) {
                setEvents(allEvents);
                // Update statistics after loading events
                await loadEventStatistics();
            } else {
                console.error('Invalid events data received');
            }
        } catch (error) {
            console.error('Error loading events:', error);
        }
    };

    useEffect(() => {
        loadEventStatistics();
    }, []);

    const loadEventStatistics = async () => {
        try {
            const userEmail = localStorage.getItem('userEmail');
            if (userEmail) {
                console.log('Loading statistics for user:', userEmail);
                const statistics = await getEventStatistics(userEmail);
                setStats(statistics);
            }
        } catch (error) {
            console.error('Error loading event statistics:', error);
            // Set default stats on error
            setStats({
                eventCount: 0,
                photoCount: 0,
                videoCount: 0,
                guestCount: 0
            });
        }
    };

    const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            // No size limit for cover images
            setNewEvent(prev => ({ ...prev, coverImage: file }));
            setCoverImagePreview(URL.createObjectURL(file));
        }
    };

    const handleOpenCreateModal = async () => {
        // Update user role to organizer
        try {
            const email = localStorage.getItem('userEmail');
            if (email) {
                // Get user info from localStorage
                let name = '';
                const userProfileStr = localStorage.getItem('userProfile');
                if (userProfileStr) {
                    try {
                        const userProfile = JSON.parse(userProfileStr);
                        name = userProfile.name || '';
                    } catch (e) {
                        console.error('Error parsing user profile from localStorage', e);
                    }
                }
                
                const mobile = localStorage.getItem('userMobile') || '';
                
                // Update user role to organizer
                await storeUserCredentials({
                    userId: email,
                    email,
                    name,
                    mobile,
                    role: 'organizer'
                });
                
                // Update local context
                setUserRole('organizer');
                console.log('User role updated to organizer');
            }
        } catch (error) {
            console.error('Error updating user role:', error);
        }
        
        // Open the modal
        setIsModalOpen(true);
    };

    const handleCreateEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEvent.name || !newEvent.date) {
            alert('Please fill in all required fields');
            return;
        }

        setIsLoading(true);
        props.setShowNavbar(false);

        try {
            const userEmail = localStorage.getItem('userEmail');
            if (!userEmail) {
                throw new Error('User not authenticated');
            }

            // Ensure user role is updated to organizer
            try {
                // Get user info from localStorage
                let name = '';
                const userProfileStr = localStorage.getItem('userProfile');
                if (userProfileStr) {
                    try {
                        const userProfile = JSON.parse(userProfileStr);
                        name = userProfile.name || '';
                    } catch (e) {
                        console.error('Error parsing user profile from localStorage', e);
                    }
                }
                
                const mobile = localStorage.getItem('userMobile') || '';
                
                // Generate event ID
                const eventId = shortid.generate();
                
                // Get existing user data to retrieve current createdEvents
                const existingUser = await getUserByEmail(userEmail);
                console.log('Retrieved existing user data:', existingUser);
                let eventIds: string[] = [];
                
                // If user already has createdEvents, use them as base
                if (existingUser && existingUser.createdEvents && Array.isArray(existingUser.createdEvents)) {
                    console.log('Found existing createdEvents array:', existingUser.createdEvents);
                    eventIds = [...existingUser.createdEvents];
                    console.log('Copied existing eventIds array:', eventIds);
                } else {
                    console.log('No existing createdEvents found, starting with empty array');
                }
                
                // Append the new event ID
                console.log('Adding new event ID:', eventId);
                eventIds.push(eventId);
                console.log('Final updated createdEvents array:', eventIds);
                
                try {
                    // Update user role to organizer and append eventId to createdEvents
                    console.log('Attempting to update user with new createdEvents array:', eventIds);
                    const userUpdateResult = await storeUserCredentials({
                        userId: userEmail,
                        email: userEmail,
                        name,
                        mobile,
                        role: 'organizer',
                        createdEvents: eventIds // Save the updated array of event IDs
                    });
                    
                    if (userUpdateResult) {
                        // Update local context
                        setUserRole('organizer');
                        console.log('Successfully updated user with new createdEvents array:', eventIds);
                    } else {
                        console.error('Failed to update user with new event ID');
                    }
                } catch (userUpdateError) {
                    console.error('Error updating user createdEvents:', userUpdateError);
                    // Continue with event creation even if createdEvents update fails
                }

                let coverImageUrl = '';
                if (newEvent.coverImage) {
                    const coverImageKey = `events/shared/${eventId}/cover.jpg`;
                    const uploadCoverImage = new Upload({
                        client: s3Client,
                        params: {
                            Bucket: S3_BUCKET_NAME,
                            Key: coverImageKey,
                            Body: newEvent.coverImage,
                            ContentType: newEvent.coverImage.type
                        },
                        partSize: 1024 * 1024 * 5
                    });
                    await uploadCoverImage.done();
                    coverImageUrl = `https://${S3_BUCKET_NAME}.s3.amazonaws.com/${coverImageKey}`;
                }

                const eventData: EventData = {
                    id: eventId,
                    name: newEvent.name,
                    date: newEvent.date,
                    description: newEvent.description,
                    coverImage: coverImageUrl,
                    photoCount: 0,
                    videoCount: 0,
                    guestCount: 0,
                    userEmail,
                    organizerId: userEmail,
                    userId: userEmail,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                // Create event folder structure
                const eventFolderKey = `events/shared/${eventId}/`;
                const folderPaths = [
                    eventFolderKey,
                    `${eventFolderKey}images/`,
                    `${eventFolderKey}selfies/`,
                    `${eventFolderKey}videos/`
                ];

                // Create folders
                for (const folderPath of folderPaths) {
                    try {
                        const upload = new Upload({
                            client: s3Client,
                            params: {
                                Bucket: S3_BUCKET_NAME,
                                Key: folderPath,
                                Body: '',
                                ContentType: 'application/x-directory'
                            },
                            queueSize: 4,
                            partSize: 1024 * 1024 * 5,
                            leavePartsOnError: false
                        });
                        await upload.done();
                    } catch (uploadError: any) {
                        console.error(`Error creating folder ${folderPath}:`, uploadError);
                        if (uploadError.name === 'SignatureDoesNotMatch') {
                            alert('AWS authentication failed. Please check your credentials.');
                        } else {
                            alert('Failed to create event folders. Please try again.');
                        }
                        setIsLoading(false);
                        return;
                    }
                }

                const success = await storeEventData(eventData);
                if (success) {
                    await loadEventStatistics();
                    await loadEvents();
                    setIsModalOpen(false);
                    setNewEvent({ id: '', name: '', date: '', description: '' });
                    setCoverImagePreview(null);

                    props.setShowNavbar(true);
                    navigate(`/view-event/${eventId}`);
                } else {
                    alert('Failed to store event data. Please try again.');
                }
            } catch (roleError) {
                console.error('Error updating user role during event creation:', roleError);
                // Continue with event creation even if role update fails
            }
        } catch (error: any) {
            console.error('Error creating event:', error);
            alert(error.message || 'Failed to create event. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (deleteConfirmation.eventId && deleteConfirmation.userEmail) {
            try {
                const success = await deleteEvent(deleteConfirmation.eventId, deleteConfirmation.userEmail);
                if (success) {
                    // After successful deletion from DynamoDB
                    loadEvents();
                    loadEventStatistics();
                    setDeleteConfirmation({isOpen: false, eventId: '', userEmail: ''});
                } else {
                    alert('Failed to delete event. Please try again.');
                }
            } catch (error) {
                console.error('Error deleting event:', error);
                alert('An error occurred while deleting the event.');
            }
        }
    };

    const handleDeleteClick = (eventId: string, userEmail: string) => {
        setDeleteConfirmation({isOpen: true, eventId, userEmail});
    };

    return (
        <div className="relative min-h-screen bg-blue-45">
            <div className="relative z-10 container mx-auto px-4 py-8">
                <div className="mb-4 sm:mb-8 flex flex-row justify-between items-center gap-2 sm:gap-4">
                    <h1 className="text-lg sm:text-2xl font-bold text-blue-900 flex-shrink-0">Event Dashboard</h1>
                    <button
                        onClick={handleOpenCreateModal}
                        className="flex-shrink-0 flex items-center justify-center bg-blue-300 text-white-700 py-1 sm:py-2 px-2 rounded-lg hover:bg-secondary transition-colors duration-200 text-xs sm:text-base"
                    >
                        <Plus className="w-3 h-3 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                        Create Event
                    </button>
                </div>
            
                <div className="flex flex-row gap-1 sm:gap-4 overflow-x-auto pb-1 sm:pb-4 -mx-4 px-4 touch-pan-x">
                    <div onClick={() => setShowAllEvents(!showAllEvents)} className="cursor-pointer flex-shrink-0 min-w-[70px] sm:min-w-[250px] sm:flex-1">
                        <StatsCard
                            icon={<Image className="w-2 h-2 sm:w-6 sm:h-6 text-blue-900" />}
                            title="Total Events"
                            count={stats.eventCount}
                            bgColor="bg-blue-200"
                        />
                    </div>
                    <div className="flex-shrink-0 min-w-[70px] sm:min-w-[250px] sm:flex-1">
                        <StatsCard
                            icon={<Camera className="w-2 h-2 sm:w-6 sm:h-6 text-blue-900" />}
                            title="Total Photos"
                            count={stats.photoCount}
                            bgColor="bg-blue-300"
                        />
                    </div>
                    <div className="flex-shrink-0 min-w-[70px] sm:min-w-[250px] sm:flex-1">
                        <StatsCard
                            icon={<Video className="w-2 h-2 sm:w-6 sm:h-6 text-blue-900" />}
                            title="Total Videos"
                            count={stats.videoCount}
                            bgColor="bg-blue-200"
                        />
                    </div>
                </div>

                {/* Create Event Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md border-2 border-blue-400 rounded-lg p-8 max-w-md w-full">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-blue-700">Create New Event</h2>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="text-black hover:text-gray-700"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <form onSubmit={handleCreateEvent} className="space-y-4">
                                {coverImagePreview && (
                                    <div className="relative w-full h-40 mb-4">
                                        <img
                                            src={coverImagePreview}
                                            alt="Cover preview"
                                            className="w-full h-full object-cover rounded-lg"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCoverImagePreview(null);
                                                setNewEvent(prev => ({ ...prev, coverImage: undefined }));
                                            }}
                                            className="absolute top-2 right-2 p-1 bg-blue-500 text-white rounded-full hover:bg-blue-600"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                                <div className="mb-4">
                                    <label className="block text-blue-900 mb-2" htmlFor="coverImage">
                                        Cover Image
                                    </label>
                                    <input
                                        type="file"
                                        id="coverImage"
                                        accept="image/*"
                                        onChange={handleCoverImageChange}
                                        className="w-full text-blue-900 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-blue-700 mb-2" htmlFor="eventName">
                                        Event Name
                                    </label>
                                    <input
                                        type="text"
                                        id="eventName"
                                        value={newEvent.name}
                                        onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                                        className="w-full border border-blue-300 rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-blue-700 mb-2" htmlFor="eventDate">
                                        Event Date
                                    </label>
                                    <input
                                        type="date"
                                        id="eventDate"
                                        value={newEvent.date}
                                        onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                                        className="w-full border border-blue-300 rounded-lg px-4 py-2 focus:outline-none focus:border-primary"
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-blue-300 text-black py-2 px-4 rounded-lg hover:bg-secondary transition-colors duration-200 disabled:opacity-50"
                                >
                                    {isLoading ? 'Creating Event...' : 'Create Event'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                <div className="text-center mb-8"></div>

                {/* Delete Confirmation Modal */}
                {deleteConfirmation.isOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 max-w-sm w-full">
                            <h3 className="text-xl font-bold text-gray-800 mb-4">Confirm Delete</h3>
                            <p className="text-gray-600 mb-6">Are you sure you want to delete this event? This action cannot be undone.</p>
                            <div className="flex justify-end space-x-4">
                                <button
                                    onClick={() => setDeleteConfirmation({isOpen: false, eventId: '', userEmail: ''})}
                                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmDelete}
                                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors duration-200"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showAllEvents && (
                    <div className="mt-4 sm:mt-8">
                        <h2 className="text-xl sm:text-2xl font-bold text-blue-900 mb-4 sm:mb-6">All Events</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                            {Array.isArray(events) && events.map((event) => (
                                <div key={event.id} className="bg-blue-200 rounded-lg shadow-md border-2 border-blue-700 overflow-hidden">
                                    <div className="w-full h-32 sm:h-48 bg-white rounded-lg shadow-md border-2 border-blue-300 flex items-center justify-center">
                                        {event.coverImage ? (
                                            <img src={event.coverImage} alt={event.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <Camera className="w-8 h-8 sm:w-12 sm:h-12 text-blue-700" />
                                        )}
                                    </div>
                                    <div className="p-2 sm:p-4">
                                        <h3 className="text-base sm:text-xl font-semibold text-blue-800 mb-1 sm:mb-2">{event.name}</h3>
                                        <p className="text-sm sm:text-base text-black-600 mb-1 sm:mb-2">{new Date(event.date).toLocaleDateString()}</p>
                                        <p className="text-xs sm:text-sm text-black-500 mb-2 sm:mb-4 line-clamp-2">{event.description}</p>
                                        <div className="flex justify-between items-center">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6"></div>
                                            <div className="mt-2 sm:mt-4 flex justify-end space-x-2 sm:space-x-4">
                                                <Link
                                                    to={`/view-event/${event.id}`}
                                                    className="bg-blue-300 text-black px-2 sm:px-4 py-1 sm:py-2 rounded-lg hover:bg-blue-600 transition-colors duration-200 text-xs sm:text-base"
                                                >
                                                    View Event
                                                </Link>
                                                <button
                                                    onClick={() => handleDeleteClick(event.id, event.userEmail)}
                                                    className="bg-blue-500 text-blue px-2 sm:px-4 py-1 sm:py-2 rounded-lg hover:bg-blue-600 transition-colors duration-200 flex items-center text-xs sm:text-base"
                                                >
                                                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
        
    );
};

export default EventDashboard;