import logo from '../../assets/logo.png';
import { getApiBaseUrl } from "../../utils/apiBaseUrl";

import { useEffect, useMemo, useState } from 'react';
import { UserListSkeleton } from '../../components/skeletons/LoadingSkeletons';

const sidebarItems = [
  'User Management',
  'Members Management',
  'Trainer Management',
  'Course Management',
  'Workshop Management',
  'Feed Management',
  'News Management',
  'Partner Management',
  'Document Center Management',
];

const events = Array.from({ length: 4 }).map((_, index) => ({
  id: index + 1,
  day: 7,
  month: 'APR',
  title: 'Be and Stay Visible in Your Market',
  time: '10:30 - 11:00 PM',
}));

export default function InstructorDashboard() {
  const [activeMenu, setActiveMenu] = useState('Members Management');
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'Admin' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const apiBaseUrl = useMemo(
    () => getApiBaseUrl(),
    [],
  );

  const fetchUsers = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setIsLoadingUsers(true);
      const response = await fetch(`${apiBaseUrl}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Failed to fetch users');
      }
      setUsers(payload.data || []);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (activeMenu === 'Members Management') {
      fetchUsers();
    }
  }, [activeMenu]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setFeedback('');
    setError('');

    const token = localStorage.getItem('token');
    if (!token) {
      setError('Please login from API first. Token not found in localStorage.');
      return;
    }

    setIsSubmitting(true);
    try {
      const roleName = formData.role === 'Trainer' ? 'Instructor' : 'Admin';
      const response = await fetch(`${apiBaseUrl}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role_name: roleName,
        }),
      });
      const payload = await response.json();
      if (!response.ok || payload.status !== 'success') {
        throw new Error(payload.message || 'Unable to create user');
      }

      setFeedback(`${formData.role} created successfully.`);
      setFormData({ name: '', email: '', password: '', role: 'Admin' });
      await fetchUsers();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f4fa] text-[#1a1a1a] flex">
      <aside className="hidden lg:flex w-64 bg-[#3420b8] text-white flex-col p-5">
        <img src={logo} alt="Workians logo" className="w-36 h-auto mb-6" />
        <nav className="space-y-1 overflow-y-auto pr-1">
          {sidebarItems.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setActiveMenu(item)}
              className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                activeMenu === item ? 'bg-white text-[#3420b8] font-semibold' : 'hover:bg-white/15'
              }`}
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-5 md:p-6">
        <header className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between gap-4 shadow-sm">
          <div className="relative w-56 md:w-72">
            <input
              type="text"
              placeholder="Search"
              className="w-full rounded-full border border-[#d4d8ff] pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4338ca]"
            />
            <span className="absolute left-4 top-2.5 text-gray-400">o</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-[#3b3bb3]">
            <a href="#" className="hover:text-[#1d1da1]">Home</a>
            <a href="#" className="hover:text-[#1d1da1]">Courses</a>
            <a href="#" className="hover:text-[#1d1da1]">Events</a>
            <a href="#" className="hover:text-[#1d1da1]">Leaderboard</a>
          </nav>
          <div className="flex items-center gap-4 text-[#3b3bb3]">
            <span>!</span>
            <span>o</span>
            <span>[]</span>
            <div className="h-10 w-10 rounded-full bg-[#1f2937] text-white text-xs flex items-center justify-center font-semibold">
              AK
            </div>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-8">
            {activeMenu === 'Members Management' ? (
              <div className="bg-white rounded-2xl border border-[#eceefb] p-5">
                <h2 className="text-2xl font-bold text-[#0d1f3d]">User Management</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Create new Admin or Trainer users. Trainer will be saved as Instructor role in backend.
                </p>

                {feedback && (
                  <div className="mt-4 p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl">
                    {feedback}
                  </div>
                )}
                {error && (
                  <div className="mt-4 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
                    {error}
                  </div>
                )}

                <form onSubmit={handleCreateUser} className="mt-5 grid md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Full Name"
                    required
                    className="w-full border border-[#e6e8f7] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4338ca]"
                  />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Email Address"
                    required
                    className="w-full border border-[#e6e8f7] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4338ca]"
                  />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Temporary Password"
                    required
                    className="w-full border border-[#e6e8f7] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4338ca]"
                  />
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full border border-[#e6e8f7] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4338ca]"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Trainer">Trainer</option>
                  </select>
                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-[#3420b8] hover:bg-[#2b179f] text-white px-6 py-3 rounded-xl font-semibold disabled:opacity-60"
                    >
                      {isSubmitting ? 'Creating...' : 'Create User'}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden bg-[#fffaf0] border border-[#ece7d8]">
              <div className="grid md:grid-cols-2">
                <div className="p-8">
                  <p className="text-5xl leading-tight font-extrabold uppercase text-[#072140]">
                    Take Care of the Work and <span className="text-[#3f62ff]">the work will take care of you.</span>
                  </p>
                </div>
                <div className="bg-[linear-gradient(140deg,#0c243f,#294566)] min-h-52 flex items-end justify-center">
                  <div className="h-52 w-36 rounded-t-full bg-slate-200/20" />
                </div>
              </div>
              </div>
            )}

            <div className="mt-4 bg-white rounded-2xl border border-[#eceefb] p-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-[#334155] text-white text-xs flex items-center justify-center font-semibold">
                  AK
                </div>
                <input
                  type="text"
                  placeholder="Start a Post"
                  className="flex-1 border border-[#eceefb] rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4338ca]"
                />
                <button type="button" className="h-9 w-9 rounded-full bg-[#f0f2fa] text-xl">+</button>
              </div>
            </div>

            <article className="mt-4 bg-white rounded-2xl border border-[#eceefb] p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#334155] text-white text-xs flex items-center justify-center font-semibold">
                    AK
                  </div>
                  <div>
                    <p className="font-semibold text-[#23304d]">Aamir Khan</p>
                    <p className="text-xs text-gray-500">Posted in Yes It Community</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">2h</p>
              </div>
              <h3 className="text-3xl font-bold text-[#0d1f3d] mt-4">Easter Love from Atlanta</h3>
              <p className="text-sm text-[#4a5b78] mt-3">Exciting Times Ahead!</p>
              <ul className="mt-3 text-sm text-[#4a5b78] space-y-1">
                <li>Introducing Infratech - Coming Soon to Sidharth Vihar</li>
                <li>Premium Location</li>
                <li>Luxury Lifestyle Amenities</li>
                <li>Future-Ready Infrastructure</li>
              </ul>
            </article>
          </div>

          <div className="xl:col-span-4">
            {activeMenu === 'Members Management' ? (
              <div className="bg-white rounded-2xl border border-[#eceefb] p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-[#1f2c4b]">Existing Users</h4>
                  <button
                    type="button"
                    onClick={fetchUsers}
                    className="text-sm text-[#3420b8] hover:underline"
                  >
                    Refresh
                  </button>
                </div>
                {isLoadingUsers ? (
                  <UserListSkeleton count={5} />
                ) : users.length === 0 ? (
                  <p className="text-sm text-gray-500">No users found.</p>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {users.map((user) => (
                      <div key={`${user.email}-${user.role}`} className="border border-[#f0f1f8] rounded-xl p-3">
                        <p className="font-semibold text-sm text-[#23304d]">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                        <p className="text-xs mt-1 text-[#3420b8]">{user.role}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#eceefb] p-4">
                <h4 className="font-semibold text-[#1f2c4b] mb-4">Upcoming Events</h4>
                <div className="space-y-3">
                  {events.map((event) => (
                    <div key={event.id} className="flex gap-3 border border-[#f0f1f8] rounded-xl p-3">
                      <div className="w-14 h-14 rounded-lg bg-[#f6f7fc] flex flex-col items-center justify-center shrink-0">
                        <span className="font-bold text-[#3e4a68] leading-none">{event.day}</span>
                        <span className="text-[10px] text-[#8089a5]">{event.month}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#23304d]">{event.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{event.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

