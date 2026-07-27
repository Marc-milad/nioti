import os
import json
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore

# Load environment variables
load_dotenv()

def init_firebase():
    """Initialize Firebase Admin SDK using .env configurations or local JSON key."""
    sa_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY_PATH", "./config/firebase-service-account.json")
    
    if os.path.exists(sa_path):
        print(f"Initializing Firebase with service account file: {sa_path}")
        cred = credentials.Certificate(sa_path)
        firebase_admin.initialize_app(cred)
    else:
        # Fallback to direct environment credentials
        project_id = os.getenv("FIREBASE_PROJECT_ID")
        client_email = os.getenv("FIREBASE_CLIENT_EMAIL")
        private_key = os.getenv("FIREBASE_PRIVATE_KEY")
        
        if project_id and client_email and private_key:
            print("Initializing Firebase with credentials from environment variables...")
            # Clean newline formatting from env keys
            formatted_private_key = private_key.replace("\\n", "\n")
            cred_dict = {
                "type": "service_account",
                "project_id": project_id,
                "client_email": client_email,
                "private_key": formatted_private_key,
                "token_uri": "https://oauth2.googleapis.com/token"
            }
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
        else:
            raise FileNotFoundError(
                "Could not find Firebase credentials. Make sure you set FIREBASE_SERVICE_ACCOUNT_KEY_PATH "
                "or define FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in your .env file."
            )

# Initial seed data
initial_patriarchs = [
    {
        "id": 1,
        "name": "القديس مرقس الرسول",
        "en": "Saint Mark the Apostle",
        "number": 1,
        "years": "43 – 68 م",
        "century": "القرن الأول",
        "era": "العصر الرسولي",
        "summary": "كاروز الديار المصرية ومؤسس كرسي الإسكندرية، حمل بشارة الإنجيل إلى أرض مصر.",
        "bio": "أسس القديس مرقس الرسول كنيسة الإسكندرية، ووضع بذرة الكرسي المرقسي الذي صار منارة للإيمان والتعليم عبر العصور.",
        "achievements": "تأسيس الكنيسة في مصر، رسامة أول أسقف للإسكندرية، وتقديم تقليد ليتورجي حي.",
        "events": "بداية البشارة المسيحية في الإسكندرية.",
        "colors": ["#2f6a6c", "#c5a266"]
    },
    {
        "id": 20,
        "name": "البابا أثناسيوس الرسولي",
        "en": "Pope Athanasius I",
        "number": 20,
        "years": "328 – 373 م",
        "century": "القرن الرابع",
        "era": "العصر الذهبي",
        "summary": "حارس الإيمان النيقاوي والمدافع الشجاع عن ألوهية السيد المسيح.",
        "bio": "قاد البابا أثناسيوس الكنيسة في واحدة من أدق مراحل تاريخها، وثبت في الدفاع عن الإيمان المستقيم رغم النفي والاضطهاد.",
        "achievements": "الدفاع عن قانون الإيمان النيقاوي، وكتابة مؤلفات لاهوتية مؤثرة.",
        "events": "مجمع نيقية وما تبعه من صراعات لاهوتية.",
        "colors": ["#6a5138", "#d6bd7e"]
    },
    {
        "id": 24,
        "name": "البابا ديسقوروس الأول",
        "en": "Pope Dioscorus I",
        "number": 24,
        "years": "444 – 454 م",
        "century": "القرن الخامس",
        "era": "عصر المجامع",
        "summary": "أحد آباء الكنيسة البارزين في الدفاع عن الإيمان الأرثوذكسي.",
        "bio": "شهدت فترة البابا ديسقوروس أحداثًا كنسية مفصلية؛ وبقي اسمه مرتبطًا بالأمانة للتقليد الإسكندري.",
        "achievements": "حماية التراث اللاهوتي للإسكندرية، ورعاية الكنيسة في زمن المجامع.",
        "events": "مجمع أفسس الثاني سنة 449 م.",
        "colors": ["#445d77", "#c38c61"]
    },
    {
        "id": 38,
        "name": "البابا بنيامين الأول",
        "en": "Pope Benjamin I",
        "number": 38,
        "years": "622 – 661 م",
        "century": "القرن السابع",
        "era": "عصر التحولات",
        "summary": "راعٍ حكيم عبر بالكنيسة زمن تغيرات عميقة في تاريخ مصر.",
        "bio": "قاد البابا بنيامين الكنيسة بحكمة وصبر في ظروف تاريخية صعبة، وظل رمزًا للرعاية والثبات.",
        "achievements": "حفظ وحدة الكنيسة وتنظيم الحياة الرعوية.",
        "events": "تحولات مصر السياسية في القرن السابع.",
        "colors": ["#7c5f3d", "#d5b46f"]
    },
    {
        "id": 67,
        "name": "البابا كيرلس الرابع",
        "en": "Pope Cyril IV",
        "number": 110,
        "years": "1854 – 1861 م",
        "century": "القرن التاسع عشر",
        "era": "عصر النهضة",
        "summary": "أبو الإصلاح القبطي الحديث، اهتم بالتعليم والطباعة والتجديد.",
        "bio": "كان البابا كيرلس الرابع صاحب رؤية إصلاحية واسعة؛ جعل التعليم في قلب نهضته وفتح آفاقًا جديدة أمام المجتمع القبطي.",
        "achievements": "إنشاء المدارس، الاهتمام بالمطبعة، وتشجيع تعليم البنات.",
        "events": "بدايات النهضة التعليمية الحديثة.",
        "colors": ["#235f5c", "#d3a959"]
    },
    {
        "id": 82,
        "name": "البابا كيرلس السادس",
        "en": "Pope Cyril VI",
        "number": 116,
        "years": "1959 – 1971 م",
        "century": "القرن العشرون",
        "era": "العصر الحديث",
        "summary": "رجل صلاة عميقة شهد عصره نهضة روحية وبناء الكاتدرائية المرقسية.",
        "bio": "اتسمت خدمته بالبساطة والصلاة، وارتبطت بتطورات كنسية مهمة في القرن العشرين.",
        "achievements": "وضع حجر أساس الكاتدرائية المرقسية بالعباسية ورعاية نهضة روحية واسعة.",
        "events": "ظهورات السيدة العذراء بالزيتون وبناء الكاتدرائية.",
        "colors": ["#4c4d76", "#c5a66a"]
    },
    {
        "id": 89,
        "name": "البابا شنودة الثالث",
        "en": "Pope Shenouda III",
        "number": 117,
        "years": "1971 – 2012 م",
        "century": "القرن العشرون",
        "era": "العصر الحديث",
        "summary": "راعٍ ومعلم وشاعر، وسّع دوائر التعليم والخدمة القبطية حول العالم.",
        "bio": "جمع البابا شنودة الثالث بين عمق التعليم وقرب الرعاية، وتكلم إلى أجيال عديدة في الداخل والمهجر.",
        "achievements": "توسيع الإيبارشيات العالمية ومدارس الأحد والاجتماعات التعليمية.",
        "events": "امتداد الخدمة القبطية إلى قارات العالم.",
        "colors": ["#355d68", "#c6905b"]
    },
    {
        "id": 96,
        "name": "البابا تواضروس الثاني",
        "en": "Pope Tawadros II",
        "number": 118,
        "years": "2012 م – حتى الآن",
        "century": "القرن الحادي والعشرون",
        "era": "العصر الحديث",
        "summary": "البابا الحالي للكنيسة القبطية الأرثوذكسية، يواصل مسيرة الرعاية والخدمة.",
        "bio": "يقود البابا تواضروس الثاني الكنيسة في زمن التواصل العالمي، مع اهتمام بالرعاية المجتمعية والشباب والمهجر.",
        "achievements": "تعزيز العمل المؤسسي والرعاية في الداخل والمهجر.",
        "events": "توسّع المبادرات الرعوية والخدمية في العصر الرقمي.",
        "colors": ["#17646a", "#d3ad62"]
    }
]

def seed_firestore():
    init_firebase()
    db = firestore.client()
    
    print("\nStarting Firestore Seeding...")
    
    # 1. Seed 'patriarchs' collection
    print("Seeding 'patriarchs' collection...")
    batch = db.batch()
    for patriarch in initial_patriarchs:
        doc_ref = db.collection("patriarchs").document(str(patriarch["id"]))
        batch.set(doc_ref, patriarch)
    
    batch.commit()
    print(f"Successfully seeded {len(initial_patriarchs)} patriarchs into the database.")
    
    # 2. Setup meta indexes or configurations collection (Optional)
    print("Setting up 'metadata' collection...")
    meta_ref = db.collection("metadata").document("app_config")
    meta_ref.set({
        "supported_languages": ["ar", "en"],
        "default_lang": "ar",
        "app_name_ar": "اثؤواب",
        "app_name_en": "Ethoab",
        "total_seeded": len(initial_patriarchs)
    })
    print("Metadata configurations initialized successfully.")
    print("\nFirestore seeding complete! Your database is now ready for Ethoab.")

if __name__ == "__main__":
    try:
        seed_firestore()
    except Exception as e:
        print(f"\nError: {e}")
