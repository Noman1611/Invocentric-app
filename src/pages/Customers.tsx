import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Mail, Phone, MapPin, UserPlus, X, Trash2, Edit2, Mic, Contact, Tag, Sliders } from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { useCustomers } from '../hooks/useData';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

import { dbService } from '../services/dbService';
import { parseContactFromText } from '../services/aiService';

export default function CustomersPage() {
  const navigate = useNavigate();
  const { user, isOfflineMode, appMode, isPro, triggerUpgradeModal } = useAuth();
  const { customers, loading } = useCustomers();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    gst_number: '',
    email: '',
    phone: '',
    address: '',
  });

  const [customFields, setCustomFields] = useState<Array<{ id: string; label: string; value: string }>>([]);

  const PRESET_CUSTOM_LABELS = [
    "PAN Number",
    "Drug License (DL)",
    "Credit Days",
    "Opening Balance",
    "Contact Person",
    "Party Code",
    "Notes / Remarks"
  ];

  const handleAddCustomField = (presetLabel?: string) => {
    setCustomFields(prev => [
      ...prev,
      { id: Math.random().toString(36).substring(2, 9), label: presetLabel || '', value: '' }
    ]);
  };

  const handleRemoveCustomField = (id: string) => {
    setCustomFields(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateCustomField = (id: string, key: 'label' | 'value', val: string) => {
    setCustomFields(prev => prev.map(item => item.id === id ? { ...item, [key]: val } : item));
  };

  const [deletingCustomer, setDeletingCustomer] = useState<{id: string, name: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const startVoiceRecognition = () => {
    // Check if running in an iframe
    let isIframe = false;
    try {
      isIframe = window.self !== window.top;
    } catch (e) {
      isIframe = true;
    }
    
    if (isIframe) {
      alert("Voice input cannot be used inside a preview frame. Please click the 'Open App' button in the top right to open the app in a new tab.");
      return;
    }

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      setIsListening(false);
      const transcript = event.results[0][0].transcript;
      const phoneMatches = transcript.match(/\d+/g);
      const phone = phoneMatches ? phoneMatches.join('').slice(0, 10) : '';
      const name = transcript.replace(/\d+/g, '').trim();

      setFormData(prev => ({
        ...prev,
        name: name || prev.name,
        phone: phone || prev.phone
      }));
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  const pickContact = async () => {
    // @ts-ignore
    if (!('contacts' in navigator && 'ContactsManager' in window)) {
      alert("Contact picker API is not supported on this device/browser.");
      return;
    }
    
    // Check if running in an iframe
    let isIframe = false;
    try {
      isIframe = window.self !== window.top;
    } catch (e) {
      isIframe = true;
    }
    
    if (isIframe) {
      alert("Contact picker cannot be used inside a preview frame. Please click the 'Open App' button in the top right to open the app in a new tab.");
      return;
    }

    try {
      const props = ['name', 'tel', 'email', 'address'];
      const opts = { multiple: false };
      // @ts-ignore
      const contactsList = await navigator.contacts.select(props, opts);
      if (contactsList && contactsList.length > 0) {
        const contact = contactsList[0];
        const name = contact.name && contact.name.length > 0 ? contact.name[0] : '';
        const phone = contact.tel && contact.tel.length > 0 ? contact.tel[0].replace(/\D/g, '').slice(-10) : '';
        const email = contact.email && contact.email.length > 0 ? contact.email[0] : '';
        
        let address = '';
        if (contact.address && contact.address.length > 0) {
          const addr = contact.address[0];
          // Try to build address from standard properties
          const parts = [addr.street, addr.city, addr.region, addr.country, addr.postalCode].filter(Boolean);
          address = parts.length > 0 ? parts.join(', ') : (addr.formatted || '');
        }

        // Try to extract company or GST if user stored them in the name or address
        // But simply setting what we get is safer
        
        setFormData(prev => ({
          ...prev,
          name: name || prev.name,
          phone: phone || prev.phone,
          email: email || prev.email,
          address: address || prev.address
        }));
      }
    } catch (ex) {
      console.error("Error picking contact", ex);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!isPro && !editingCustomer && customers.length >= 30) {
      triggerUpgradeModal('Customer/Party Limit Reached', [
        'Free Plan accounts can store up to 30 customer/party profiles.',
        'Pro Plan offers unlimited customers, detailed group lists, and balance tracking.',
        'Enable automatic WhatsApp/SMS ledger sharing, dynamic statement summaries, and Excel import/export.'
      ]);
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanCustomFields = customFields.filter(f => f.label.trim() !== '' || f.value.trim() !== '');

      const data: any = {
        name: formData.name,
        company_name: formData.company_name,
        gst_number: formData.gst_number,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        custom_fields: cleanCustomFields,
      };

      if (editingCustomer) {
        await dbService.update('customers', editingCustomer.id, data, { offlineMode: isOfflineMode, userId: user.uid });
      } else {
        await dbService.add('customers', data, { offlineMode: isOfflineMode, userId: user.uid });
      }
      setShowAddModal(false);
      setEditingCustomer(null);
      setFormData({ name: '', company_name: '', gst_number: '', email: '', phone: '', address: '' });
      setCustomFields([]);
    } catch (error) {
      console.error("Error saving customer:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (customer: any) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      company_name: customer.company_name || '',
      gst_number: customer.gst_number || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
    });
    setCustomFields(customer.custom_fields || []);
    setShowAddModal(true);
  };

  const handleDelete = async (customerId: string, name: string) => {
    setDeletingCustomer({ id: customerId, name });
  };

  const confirmDelete = async () => {
    if (!deletingCustomer || !user) return;
    setIsDeleting(true);
    try {
      await dbService.delete('customers', deletingCustomer.id, { offlineMode: isOfflineMode, userId: user.uid });
      setDeletingCustomer(null);
    } catch (error) {
      console.error("Error deleting customer:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl tracking-tight">{appMode === 'freelancer' ? 'Client Directory' : 'Customer Directory'}</h1>
          <p className="text-slate-500 mt-1 text-sm">
            {appMode === 'freelancer' ? 'Manage your core business clients and profiles.' : 'Manage your business customers and profiles.'}
          </p>
        </div>
        <button 
          onClick={() => {
            if (!isPro && customers.length >= 30) {
              triggerUpgradeModal('Customer/Party Limit Reached', [
                'Free Plan accounts can store up to 30 customer/party profiles.',
                'Pro Plan offers unlimited customers, detailed group lists, and balance tracking.',
                'Enable automatic WhatsApp/SMS ledger sharing, dynamic statement summaries, and Excel import/export.'
              ]);
              return;
            }
            setEditingCustomer(null);
            setFormData({ name: '', company_name: '', gst_number: '', email: '', phone: '', address: '' });
            setCustomFields([]);
            setShowAddModal(true);
          }}
          className="btn-primary flex items-center gap-2 w-fit group"
        >
          <UserPlus size={18} className="transition-transform group-hover:scale-110" />
          <span className="text-sm">{appMode === 'freelancer' ? 'Register Client' : 'Add Customer'}</span>
        </button>
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
        <input 
          type="text" 
          placeholder="Search by name, email, or company entity..." 
          className="input-field pl-12 h-12"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="py-24 text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse [animation-delay:-0.2s]" />
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse [animation-delay:-0.4s]" />
          </div>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="card-base py-24 text-center bg-slate-50/50">
            <div className="max-w-xs mx-auto">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center border border-slate-100 mx-auto mb-4">
                <UserPlus className="text-slate-500" size={32} />
              </div>
              <p className="text-slate-900 font-bold text-sm">
                {appMode === 'freelancer' ? 'No client records' : 'No customer records'}
              </p>
              <p className="text-slate-500 text-xs mt-1">
                {appMode === 'freelancer' ? 'Start by registering your first client to build your directory.' : 'Start by adding your first customer to build your directory.'}
              </p>
            </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredCustomers.map((customer, i) => (
            <motion.div
              key={customer.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="card-base p-6 group hover:ring-2 hover:ring-green-500/20 transition-all flex flex-col h-full bg-white"
            >
              <div className="flex items-start justify-between mb-5">
                <div className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center text-sm font-bold text-slate-700 ring-1 ring-slate-100">
                  {customer.name.charAt(0)}
                </div>
                <div className="flex items-center gap-1 opacity-100 transition-opacity">
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const num = (customer.phone || '').replace(/[^0-9]/g, '');
                      const upi = user?.email || 'payments@upi';
                      const msg = encodeURIComponent(`Dear ${customer.name}, gentle reminder regarding your outstanding balance with us. Please clear the pending dues. Thank you!`);
                      window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
                    }}
                    className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-all"
                    title="1-Click WhatsApp Payment Reminder"
                  >
                    <Phone size={16} />
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleEdit(customer); }}
                    className="p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
                    title="Update Profile"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDelete(customer.id, customer.name); }}
                    className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-all"
                    title="Delete Entry"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="flex-1">
                <h3 className="font-bold text-slate-900 truncate leading-tight">{customer.name}</h3>
                {customer.company_name && (
                  <p className="text-[11px] font-bold text-green-600 mt-1 uppercase tracking-wider">
                    {customer.company_name}
                  </p>
                )}
                
                <div className="mt-5 space-y-2.5">
                  <div className="flex items-center gap-2.5 text-xs text-slate-500">
                    <Mail size={14} className="text-slate-500" />
                    <span className="truncate">{customer.email || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-slate-500">
                    <Phone size={14} className="text-slate-500" />
                    <span>{customer.phone || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs text-slate-500">
                    <MapPin size={14} className="text-slate-500" />
                    <span className="truncate leading-relaxed">{customer.address || '—'}</span>
                  </div>
                </div>

                {customer.custom_fields && customer.custom_fields.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
                    {customer.custom_fields.map((cf: any, idx: number) => (
                      <div key={idx} className="bg-green-50/80 border border-green-100/80 text-green-800 px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1">
                        <span className="font-bold text-green-600">{cf.label}:</span>
                        <span className="font-semibold">{cf.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6 pt-5 border-t border-slate-50">
                <button
                  onClick={() => navigate(`/customers/statement/${customer.id}`)}
                  className="w-full py-2.5 bg-slate-50 hover:bg-green-600 hover:text-white text-slate-600 text-[10px] font-bold rounded-lg transition-all uppercase tracking-widest"
                >
                  View Full Statement
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Client Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowAddModal(false); setEditingCustomer(null); }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl tracking-tight font-medium">
                    {editingCustomer 
                      ? (appMode === 'freelancer' ? 'Update Client Profile' : 'Update Customer Profile') 
                      : (appMode === 'freelancer' ? 'New Client Registration' : 'New Customer Registration')}
                  </h2>
                  <button 
                    onClick={() => { setShowAddModal(false); setEditingCustomer(null); }}
                    className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-500"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between ml-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Client Name</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={startVoiceRecognition}
                            className={`p-1.5 rounded-full transition-colors ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'}`}
                            title="Voice Input"
                          >
                            <Mic size={14} />
                          </button>
                          {'contacts' in navigator && 'ContactsManager' in window && (
                            <button
                              type="button"
                              onClick={pickContact}
                              className="p-1.5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                              title="Select from Contacts"
                            >
                              <Contact size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      <input 
                        required
                        className="input-field h-11" 
                        placeholder="e.g. John Doe"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Legal Company Name</label>
                      <input 
                        className="input-field h-11" 
                        placeholder="e.g. Acme Industries Ltd."
                        value={formData.company_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">GST Identification</label>
                      <input 
                        className="input-field h-11 uppercase" 
                        placeholder="22AAAAA0000A1Z5"
                        value={formData.gst_number}
                        onChange={(e) => setFormData(prev => ({ ...prev, gst_number: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Email Address</label>
                      <input 
                        type="email" 
                        className="input-field h-11" 
                        placeholder="name@company.com"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Contact Number</label>
                      <input 
                        type="tel" 
                        className="input-field h-11" 
                        placeholder="+91 98765 43210"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Address / Location</label>
                      <input 
                        className="input-field h-11" 
                        placeholder="City, State, Zip"
                        value={formData.address}
                        onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* CUSTOM PARTY DETAILS / SPECIFIC FIELDS */}
                  <div className="pt-5 border-t border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Tag size={16} className="text-green-600" />
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          Custom Details / Specific Party Fields
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddCustomField()}
                        className="text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200/80 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={14} /> Add Custom Field
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      Add any specific info like DL Number, PAN, Credit Limit, Opening Balance, or Custom Notes.
                    </p>

                    {/* Quick Preset Badges */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-[11px] text-slate-400 font-semibold self-center mr-1">Quick Add:</span>
                      {PRESET_CUSTOM_LABELS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleAddCustomField(preset)}
                          className="text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-green-50 hover:text-green-700 hover:border-green-300 border border-slate-200 px-2.5 py-1 rounded-md transition-all cursor-pointer"
                        >
                          + {preset}
                        </button>
                      ))}
                    </div>

                    {/* Custom Fields Input List */}
                    {customFields.length > 0 && (
                      <div className="space-y-2 mt-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
                        {customFields.map((field) => (
                          <div key={field.id} className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Field Label (e.g. PAN)"
                              value={field.label}
                              onChange={(e) => handleUpdateCustomField(field.id, 'label', e.target.value)}
                              className="input-field h-9 text-xs flex-1 bg-white"
                            />
                            <input
                              type="text"
                              placeholder="Value (e.g. ABCDE1234F)"
                              value={field.value}
                              onChange={(e) => handleUpdateCustomField(field.id, 'value', e.target.value)}
                              className="input-field h-9 text-xs flex-1 bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomField(field.id)}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0 cursor-pointer"
                              title="Delete Field"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-6">
                    <button 
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="btn-secondary flex-1 py-1"
                    >
                      Dismiss
                    </button>
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="btn-primary flex-1 py-1"
                    >
                      {isSubmitting ? 'Processing...' : (editingCustomer ? 'Update Entry' : 'Create Record')}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingCustomer(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={24} />
              </div>
              <h2 className="text-xl mb-2 tracking-tight font-medium">Remove Client?</h2>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                This will permanently delete <span className="font-bold text-slate-900">{deletingCustomer.name}</span> and their profile records.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setDeletingCustomer(null)}
                  className="btn-secondary py-2 text-sm"
                >
                  Keep Profile
                </button>
                <button 
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="bg-rose-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-rose-700 transition-all disabled:opacity-50"
                >
                  {isDeleting ? 'Removing...' : 'Delete Permanently'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
