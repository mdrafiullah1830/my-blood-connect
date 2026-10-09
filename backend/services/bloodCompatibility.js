// ei module te blood group compatibility matrix ache — donor theke recipient kivabe pabe seta define kore.

// prothom index = donor blood group, value = jader ke donate korte pare.
const DONOR_COMPATIBILITY = {
    'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    'O+': ['O+', 'A+', 'B+', 'AB+'],
    'A-': ['A-', 'A+', 'AB-', 'AB+'],
    'A+': ['A+', 'AB+'],
    'B-': ['B-', 'B+', 'AB-', 'AB+'],
    'B+': ['B+', 'AB+'],
    'AB-': ['AB-', 'AB+'],
    'AB+': ['AB+']
};

// jodi recipient er bloodGroup X dorkar hoy, tahole ke ke donate korte pare seta return kore.
const donorsFor = (recipientBloodGroup) =>
    Object.keys(DONOR_COMPATIBILITY).filter((donor) => DONOR_COMPATIBILITY[donor].includes(recipientBloodGroup));

// donor er theke recipient compatible kina check kore.
const isCompatible = (donorBloodGroup, recipientBloodGroup) =>
    Boolean(DONOR_COMPATIBILITY[donorBloodGroup]?.includes(recipientBloodGroup));

// universal donor/recipient indicator.
const isUniversalDonor = (group) => group === 'O-';
const isUniversalRecipient = (group) => group === 'AB+';

module.exports = { DONOR_COMPATIBILITY, donorsFor, isCompatible, isUniversalDonor, isUniversalRecipient };
