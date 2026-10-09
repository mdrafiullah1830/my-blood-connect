import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, Mail, Lock, Phone, MapPin, AlertCircle, Scale } from 'lucide-react';
import { divisions as fallbackDivisions, commonThanas as fallbackThanas } from '../data/bangladeshLocations';
import { API_URL } from '../lib/api';
import { getAccuratePosition } from '../lib/geolocation';

// ei page e notun user er registration form kora hoy, ar address/doctor/blood data database e send kora hoy.
export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name:'', email:'', password:'', phone:'', bloodGroup:'A+', age:'', weight:'', division:'', district:'', thana:'', city:'', latitude:'', longitude:'', nidDocument:'', birthCertificateDocument:'', isAvailable:true });
  const [errorMsg, setErrorMsg] = useState(''); const [successMsg, setSuccessMsg] = useState(''); const [loading, setLoading] = useState(false);
  const [locationOptions, setLocationOptions] = useState({ divisions:fallbackDivisions, thanas:fallbackThanas });
  const [locationsLoading, setLocationsLoading] = useState(true);

  useEffect(() => { getAccuratePosition().then((p)=>setFormData((v)=>({...v,latitude:p.latitude,longitude:p.longitude,accuracy:p.accuracy}))).catch(()=>{}); }, []);
  useEffect(() => { loadAllLocations().then(setLocationOptions).catch(() => setErrorMsg('Could not load the complete Bangladesh location list. Please refresh and try again.')).finally(() => setLocationsLoading(false)); }, []);
  const change = (e) => setFormData((p) => ({ ...p, [e.target.name]:e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const divisionChange = (e) => setFormData((p) => ({ ...p, division:e.target.value, district:'', thana:'' }));
  const districtChange = (e) => setFormData((p) => ({ ...p, district:e.target.value, thana:'' }));

  const submit = async (e) => {
    e.preventDefault(); setErrorMsg(''); setSuccessMsg('');
    if (!formData.division || !formData.district || !formData.thana || !formData.city) return setErrorMsg('Please complete Division, District, Thana and City/Area.');
    if (formData.isAvailable && (!formData.age || !formData.weight)) return setErrorMsg('Age and weight are required when registering as an available donor.');
    setLoading(true);
    try { await axios.post(`${API_URL}/api/auth/register`, formData); setSuccessMsg('Registration successful. Log in to verify your phone/email and finish your profile.'); setTimeout(() => navigate('/login'), 1500); }
    catch (err) { setErrorMsg(err.response?.data?.message || 'Registration failed.'); } finally { setLoading(false); }
  };

  return <div className="min-h-screen bg-slate-950 text-white p-6 flex justify-center"><div className="w-full max-w-3xl pt-10"><div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-7"><div className="text-center mb-8"><h1 className="text-4xl font-black text-red-500">Create Your Account</h1><p className="text-slate-400 mt-2">One account for both Donor and Recipient modes</p></div>
    {errorMsg && <div className="mb-5 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400"><AlertCircle className="inline w-4 h-4 mr-2" />{errorMsg}</div>}{successMsg && <div className="mb-5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">{successMsg}</div>}
    <form onSubmit={submit} autoComplete="on" className="grid md:grid-cols-2 gap-5">
      <Field icon={<User />} label="Full Name"><input name="name" autoComplete="name" required value={formData.name} onChange={change} className={input} /></Field><Field icon={<Mail />} label="Email"><input type="email" name="email" autoComplete="username" required value={formData.email} onChange={change} className={input} /></Field><Field icon={<Lock />} label="Password"><input type="password" name="password" autoComplete="new-password" minLength="8" required value={formData.password} onChange={change} className={input} /></Field><Field icon={<Phone />} label="Phone"><input name="phone" autoComplete="tel" minLength="7" maxLength="20" required value={formData.phone} onChange={change} className={input} /></Field>
      <Select label="Blood Group" name="bloodGroup" value={formData.bloodGroup} onChange={change} options={['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((x)=>[x,x])} /><Field icon={<User />} label="Age (needed for Donor Mode)"><input type="number" min="1" max="120" name="age" value={formData.age} onChange={change} className={input} /></Field><Field icon={<Scale />} label="Weight kg (needed for Donor Mode)"><input type="number" min="1" max="300" name="weight" value={formData.weight} onChange={change} className={input} /></Field>
      <Select label="Division" name="division" value={formData.division} onChange={divisionChange} disabled={locationsLoading} options={Object.keys(locationOptions.divisions).map((x)=>[x,x])} /><Select label="District" name="district" value={formData.district} onChange={districtChange} disabled={!formData.division || locationsLoading} options={(locationOptions.divisions[formData.division]||[]).map((x)=>[x,x])} />
      <Select label={`Thana / Upazila${formData.district ? ` (${(locationOptions.thanas[formData.district]||[]).length})` : ''}`} name="thana" value={formData.thana} onChange={change} disabled={!formData.district || locationsLoading} options={(locationOptions.thanas[formData.district]||[]).map((x)=>[x,x])} /><Field icon={<MapPin />} label="City / Area"><input name="city" required value={formData.city} onChange={change} className={input} /></Field>
      <Field label="NID / Document URL (optional)"><input name="nidDocument" value={formData.nidDocument} onChange={change} className={input} placeholder="https://..." /></Field><Field label="Birth Certificate / Document URL (optional)"><input name="birthCertificateDocument" value={formData.birthCertificateDocument} onChange={change} className={input} placeholder="https://..." /></Field>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 md:col-span-2"><input type="checkbox" name="isAvailable" checked={formData.isAvailable} onChange={change} className="mt-1 h-5 w-5 accent-emerald-500"/><span><strong className="block text-emerald-300">Available for blood donation</strong><span className="text-sm text-slate-400">Keep this selected to appear in recipient donor searches after registration. You can change it anytime from Donor Mode.</span></span></label>
      <div className="md:col-span-2"><button type="button" onClick={()=>getAccuratePosition().then((p)=>setFormData((v)=>({...v,latitude:p.latitude,longitude:p.longitude,accuracy:p.accuracy}))).catch(()=>setErrorMsg('Could not capture precise GPS. Turn on device Location and try again.'))} className="px-4 py-3 rounded-xl border border-slate-700 text-slate-300"><MapPin className="inline w-4 h-4 mr-2"/>Capture Current GPS</button><p className="text-xs text-slate-500 mt-2">GPS is used only for nearby donor search.{formData.accuracy ? ` Browser accuracy: about ${Math.round(formData.accuracy)} m.` : ''}</p></div>
      <button disabled={loading} className="md:col-span-2 bg-red-600 hover:bg-red-700 rounded-xl py-4 font-black disabled:opacity-50">{loading?'Creating...':'Create Account'}</button>
    </form><p className="text-center text-slate-500 mt-6">Already registered? <Link to="/login" className="text-red-400">Login</Link></p>
  </div></div></div>;
}
const input='w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-red-500';
function Field({icon,label,children}){return <div><label className="block text-xs uppercase text-slate-400 mb-2">{icon}{label}</label>{children}</div>}
function Select({label,name,value,onChange,options,disabled}){return <div><label className="block text-xs uppercase text-slate-400 mb-2">{label}</label><select required disabled={disabled} name={name} value={value} onChange={onChange} className={`${input} cursor-pointer`}><option value="">Choose</option>{options.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></div>}

async function loadAllLocations() {
  const response = await fetch(`${API_URL}/api/locations/hierarchy`);
  if (!response.ok) throw new Error('Location service unavailable');
  const data = await response.json();
  if (!data.divisions || !data.thanas) throw new Error('Invalid location data');
  return { divisions:data.divisions, thanas:data.thanas };
}
