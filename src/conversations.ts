import { canPractice, contentKey, type State } from "./core";
import type { ConversationAnswer, ConversationAttempt } from "./practice-data";
import {
  isWeakEvidence,
  selectLearningEvidence,
  validEvidenceTime,
} from "./evidence";

export type DialogueTarget = {
  id: string;
  lemma: string;
  partOfSpeech: string;
  meaning: string;
  context: string;
};
export type DialogueLine = { speaker: string; en: string; vi: string };
export type DialogueQuestion = {
  id: string;
  kind: "comprehension" | "cloze" | "meaning";
  prompt: string;
  targetIds: string[];
  options?: string[];
  accepted: string[];
  explanation: string;
};
export type Dialogue = {
  id: string;
  version: string;
  title: string;
  level: "B1" | "B2";
  lines: DialogueLine[];
  targets: DialogueTarget[];
  questions: DialogueQuestion[];
  reply: string;
};

const t = (
  lemma: string,
  partOfSpeech: string,
  meaning: string,
  context: string,
): DialogueTarget => ({
  id: `${lemma}-01`,
  lemma,
  partOfSpeech,
  meaning,
  context,
});
const line = (speaker: string, en: string, vi: string): DialogueLine => ({
  speaker,
  en,
  vi,
});
const choice = (
  id: string,
  kind: "comprehension" | "meaning",
  prompt: string,
  targets: string[],
  options: string[],
  correct: number,
  explanation: string,
): DialogueQuestion => {
  // Stable per-question ordering avoids always placing the authored answer first.
  const offset =
    [...prompt].reduce((sum, character) => sum + character.codePointAt(0)!, 0) %
    options.length;
  return {
    id,
    kind,
    prompt,
    targetIds: targets.map((w) => `${w}-01`),
    options: [...options.slice(offset), ...options.slice(0, offset)],
    accepted: [options[correct]],
    explanation,
  };
};
const gap = (
  lemma: string,
  prompt: string,
  explanation: string,
): DialogueQuestion => ({
  id: "gap",
  kind: "cloze",
  prompt,
  targetIds: [`${lemma}-01`],
  accepted: [lemma],
  explanation,
});
const dialogue = (value: Omit<Dialogue, "version">): Dialogue => ({
  ...value,
  version: `authored-2026-10-v1:${value.id}`,
});

// These are original teaching dialogues, not excerpts from Oxford or AI output.
// Exact sense guards below exclude edited, archived or unreviewed source entries.
export const dialogues: Dialogue[] = [
  dialogue({
    id: "assignment-feedback",
    title: "Xin góp ý trước hạn nộp",
    level: "B1",
    targets: [
      t(
        "assignment",
        "noun",
        "bài tập được giao",
        "bài viết được giảng viên giao",
      ),
      t("deadline", "noun", "hạn chót", "thời điểm cuối phải nộp bài"),
      t("feedback", "noun", "nhận xét góp ý", "góp ý để sửa bản nháp"),
      t("improve", "verb", "cải thiện", "làm phần kết luận tốt hơn"),
    ],
    lines: [
      line(
        "Maya",
        "Could you read my assignment before I hand it in?",
        "Bạn đọc giúp bài tập của mình trước khi mình nộp được không?",
      ),
      line(
        "Ben",
        "Of course. When is the deadline?",
        "Được chứ. Hạn chót là khi nào?",
      ),
      line(
        "Maya",
        "Friday afternoon. I need some feedback on the conclusion.",
        "Chiều thứ Sáu. Mình cần góp ý về phần kết luận.",
      ),
      line(
        "Ben",
        "Your main point is clear, but one example would improve it.",
        "Ý chính của bạn rõ rồi, nhưng thêm một ví dụ sẽ làm nó tốt hơn.",
      ),
      line(
        "Maya",
        "That's helpful. I'll add an example from the report.",
        "Góp ý hữu ích đấy. Mình sẽ thêm một ví dụ từ bản báo cáo.",
      ),
      line(
        "Ben",
        "Send me the new version tomorrow and we'll check it together.",
        "Ngày mai gửi mình bản mới rồi chúng ta cùng kiểm tra nhé.",
      ),
    ],
    questions: [
      choice(
        "understand",
        "comprehension",
        "Maya cần Ben giúp điều gì?",
        ["assignment", "feedback"],
        [
          "Góp ý cho phần kết luận của bài tập",
          "Nộp bài thay vào thứ Sáu",
          "Viết toàn bộ bài tập mới",
        ],
        0,
        "Maya nói rõ cô cần feedback on the conclusion; Ben đề nghị thêm một ví dụ.",
      ),
      gap(
        "deadline",
        "When is the ____?",
        "Deadline là hạn chót; câu hỏi muốn biết thời điểm cuối phải nộp bài.",
      ),
      choice(
        "sense",
        "meaning",
        "improve it trong lời Ben có nghĩa gì?",
        ["improve"],
        [
          "Làm phần kết luận tốt hơn",
          "Nộp phần kết luận muộn hơn",
          "Bỏ phần kết luận",
        ],
        0,
        "It thay cho phần kết luận đang được bàn; ví dụ sẽ giúp phần này tốt hơn.",
      ),
    ],
    reply:
      "Bạn là Maya. Hãy cảm ơn Ben và đề nghị một giờ cụ thể để cùng xem bản sửa.",
  }),
  dialogue({
    id: "checking-research",
    title: "Kiểm tra một thông tin trước khi chia sẻ",
    level: "B2",
    targets: [
      t(
        "research",
        "noun",
        "nghiên cứu",
        "nghiên cứu được viện dẫn trong bài báo",
      ),
      t("evidence", "noun", "bằng chứng", "dữ liệu hỗ trợ một kết luận"),
      t(
        "source",
        "noun",
        "nguồn thông tin",
        "nghiên cứu gốc cung cấp thông tin",
      ),
      t(
        "reliable",
        "adjective",
        "đáng tin cậy",
        "nguồn có thể tin dùng sau khi kiểm tra",
      ),
    ],
    lines: [
      line(
        "Nora",
        "This article says working four days a week always makes people happier.",
        "Bài này nói làm việc bốn ngày một tuần luôn khiến mọi người hạnh phúc hơn.",
      ),
      line(
        "Leo",
        "Does it link to the original research?",
        "Nó có liên kết đến nghiên cứu gốc không?",
      ),
      line(
        "Nora",
        "Yes, but the study only followed one small company.",
        "Có, nhưng nghiên cứu chỉ theo dõi một công ty nhỏ.",
      ),
      line(
        "Leo",
        "Then the evidence may not support such a broad claim.",
        "Vậy bằng chứng có thể chưa đủ để hỗ trợ một khẳng định bao quát như thế.",
      ),
      line(
        "Nora",
        "So the source isn't necessarily wrong, but the headline goes too far?",
        "Vậy nguồn không nhất thiết sai, nhưng tiêu đề đã khẳng định quá mức à?",
      ),
      line(
        "Leo",
        "Exactly. A reliable report should explain the limits as well as the results.",
        "Đúng vậy. Một báo cáo đáng tin cậy nên giải thích cả giới hạn lẫn kết quả.",
      ),
      line(
        "Nora",
        "I'll read the full study before sharing the article.",
        "Mình sẽ đọc toàn bộ nghiên cứu trước khi chia sẻ bài báo.",
      ),
      line(
        "Leo",
        "Good idea. We can compare it with other studies too.",
        "Ý hay đấy. Chúng ta cũng có thể so sánh với các nghiên cứu khác.",
      ),
    ],
    questions: [
      choice(
        "understand",
        "comprehension",
        "Vì sao Leo dè dặt với khẳng định trong tiêu đề?",
        ["research", "evidence"],
        [
          "Nghiên cứu chỉ theo dõi một công ty nhỏ",
          "Bài báo không có bất kỳ liên kết nào",
          "Leo cho rằng mọi nghiên cứu đều sai",
        ],
        0,
        "Một mẫu nhỏ không đủ để suy rộng thành always cho tất cả mọi người.",
      ),
      gap(
        "source",
        "So the ____ isn't necessarily wrong, but the headline goes too far?",
        "Source là nguồn thông tin; ở đây là nghiên cứu đứng sau bài báo.",
      ),
      choice(
        "sense",
        "meaning",
        "reliable report được hiểu thế nào trong cuộc trao đổi?",
        ["reliable"],
        [
          "Báo cáo có thể tin cậy, nêu cả giới hạn",
          "Báo cáo có tiêu đề mạnh nhất",
          "Báo cáo được chia sẻ nhiều nhất",
        ],
        0,
        "Leo gắn độ tin cậy với việc giải thích giới hạn bằng chứng, không phải độ nổi tiếng.",
      ),
    ],
    reply:
      "Bạn là Nora. Hãy viết một câu chia sẻ kết quả nghiên cứu mà vẫn nêu giới hạn của nó.",
  }),
  dialogue({
    id: "buying-a-desk",
    title: "Chọn bàn trong mức chi dự kiến",
    level: "B1",
    targets: [
      t(
        "budget",
        "noun",
        "ngân sách; khoản tiền dự tính cho một việc",
        "số tiền tối đa dự tính mua bàn",
      ),
      t("price", "noun", "giá; giá bán", "giá bán được niêm yết"),
      t(
        "affordable",
        "adjective",
        "có giá phải chăng",
        "có giá nằm trong khả năng chi trả",
      ),
      t("cost", "noun", "chi phí", "chi phí giao hàng ngoài giá bàn"),
    ],
    lines: [
      line(
        "Anna",
        "I need a desk, but my budget is only a hundred pounds.",
        "Mình cần một chiếc bàn, nhưng ngân sách chỉ có một trăm bảng.",
      ),
      line(
        "Sam",
        "The price of this one is eighty pounds.",
        "Giá chiếc này là tám mươi bảng.",
      ),
      line(
        "Anna",
        "That seems affordable. Is delivery included?",
        "Có vẻ vừa túi tiền đấy. Đã gồm giao hàng chưa?",
      ),
      line(
        "Sam",
        "No. There's an extra cost of fifteen pounds for delivery.",
        "Chưa. Có thêm chi phí giao hàng là mười lăm bảng.",
      ),
      line(
        "Anna",
        "Ninety-five altogether, then. I can manage that.",
        "Vậy tổng cộng là chín mươi lăm. Mình chi được mức đó.",
      ),
      line(
        "Sam",
        "Let's check the measurements before you order it.",
        "Hãy kiểm tra kích thước trước khi bạn đặt nhé.",
      ),
    ],
    questions: [
      choice(
        "understand",
        "comprehension",
        "Anna sẽ trả tổng cộng bao nhiêu nếu mua bàn và giao hàng?",
        ["price", "cost", "budget"],
        ["95 bảng", "80 bảng", "115 bảng"],
        0,
        "Giá bàn 80 bảng cộng chi phí giao hàng 15 bảng là 95 bảng, trong ngân sách 100 bảng.",
      ),
      gap(
        "affordable",
        "That seems ____. Is delivery included?",
        "Affordable ở đây là có giá mà Anna có khả năng chi trả.",
      ),
      choice(
        "sense",
        "meaning",
        "budget trong câu đầu là gì?",
        ["budget"],
        [
          "Khoản tiền Anna dự tính dùng",
          "Khoản giảm giá cửa hàng phải trả",
          "Giá giao hàng cố định",
        ],
        0,
        "My budget là số tiền Anna dành cho việc mua bàn, không phải giá cửa hàng niêm yết.",
      ),
    ],
    reply:
      "Bạn là Anna. Hãy hỏi xem có thể nhận hàng tại cửa hàng để tiết kiệm phí giao không.",
  }),
  dialogue({
    id: "work-rest-balance",
    title: "Điều chỉnh nhịp làm việc",
    level: "B1",
    targets: [
      t("stress", "noun", "căng thẳng", "áp lực do làm việc muộn thường xuyên"),
      t(
        "balance",
        "noun",
        "sự cân bằng",
        "phân bổ thời gian giữa công việc và nghỉ ngơi",
      ),
      t(
        "routine",
        "noun",
        "nếp sinh hoạt; chuỗi việc làm thường xuyên",
        "thói quen sinh hoạt hằng ngày",
      ),
      t(
        "healthy",
        "adjective",
        "khỏe mạnh; có sức khỏe tốt",
        "duy trì trạng thái sức khỏe tốt",
      ),
    ],
    lines: [
      line(
        "Alex",
        "I've been working late every night, and the stress is getting to me.",
        "Tối nào mình cũng làm muộn, và căng thẳng đang ảnh hưởng đến mình.",
      ),
      line(
        "Jo",
        "Could you make more time for rest?",
        "Bạn có thể dành thêm thời gian nghỉ ngơi không?",
      ),
      line(
        "Alex",
        "I need a better balance between work and everything else.",
        "Mình cần sự cân bằng tốt hơn giữa công việc và những việc khác.",
      ),
      line(
        "Jo",
        "What does your evening routine look like?",
        "Nếp sinh hoạt buổi tối của bạn như thế nào?",
      ),
      line(
        "Alex",
        "I answer emails until I go to bed.",
        "Mình trả lời email đến tận lúc đi ngủ.",
      ),
      line(
        "Jo",
        "I stop checking mine at eight. It helps me stay healthy and sleep better.",
        "Mình ngừng kiểm tra email lúc tám giờ. Việc đó giúp mình khỏe mạnh và ngủ tốt hơn.",
      ),
      line(
        "Alex",
        "I'll try that this week and see how I feel.",
        "Tuần này mình sẽ thử và xem cảm thấy thế nào.",
      ),
      line(
        "Jo",
        "Start with something manageable. You don't have to change everything at once.",
        "Bắt đầu bằng việc vừa sức thôi. Bạn không cần thay đổi tất cả cùng một lúc.",
      ),
    ],
    questions: [
      choice(
        "understand",
        "comprehension",
        "Alex định thử thay đổi điều gì?",
        ["routine", "balance"],
        [
          "Ngừng kiểm tra email vào buổi tối sớm hơn",
          "Làm thêm mỗi tối",
          "Thay đổi mọi thói quen ngay lập tức",
        ],
        0,
        "That nhắc lại việc Jo ngừng kiểm tra email lúc tám giờ.",
      ),
      gap(
        "stress",
        "The ____ is getting to me.",
        "The stress is getting to me nghĩa là căng thẳng bắt đầu ảnh hưởng xấu đến người nói.",
      ),
      choice(
        "sense",
        "meaning",
        "balance ở đây nói đến điều gì?",
        ["balance"],
        [
          "Sự cân đối thời gian công việc và đời sống",
          "Số tiền trong tài khoản",
          "Khả năng đứng không bị ngã",
        ],
        0,
        "Cụm between work and everything else xác định rõ nghĩa cân bằng công việc và đời sống.",
      ),
    ],
    reply:
      "Bạn là Alex. Hãy đề xuất một thay đổi nhỏ trong buổi tối và giải thích lý do.",
  }),
  dialogue({
    id: "protecting-a-device",
    title: "Bảo vệ dữ liệu trên thiết bị",
    level: "B1",
    targets: [
      t("device", "noun", "thiết bị", "chiếc máy tính bảng mới"),
      t("password", "noun", "mật khẩu", "chuỗi dùng để bảo vệ quyền truy cập"),
      t(
        "privacy",
        "noun",
        "quyền riêng tư",
        "quyền kiểm soát thông tin cá nhân",
      ),
      t("software", "noun", "phần mềm", "các chương trình cần cập nhật"),
    ],
    lines: [
      line(
        "Rina",
        "I've bought a new tablet. Can you help me set up the device?",
        "Mình vừa mua máy tính bảng mới. Bạn giúp mình thiết lập thiết bị nhé?",
      ),
      line(
        "Dan",
        "Sure. First, choose a strong password that you don't use anywhere else.",
        "Được. Trước hết, chọn một mật khẩu mạnh mà bạn không dùng ở nơi nào khác.",
      ),
      line(
        "Rina",
        "Should I check the privacy settings too?",
        "Mình cũng nên kiểm tra cài đặt quyền riêng tư à?",
      ),
      line(
        "Dan",
        "Yes. You can decide which apps can see your location.",
        "Đúng. Bạn có thể quyết định ứng dụng nào được xem vị trí của mình.",
      ),
      line(
        "Rina",
        "And I'll keep the software up to date.",
        "Và mình sẽ luôn cập nhật phần mềm.",
      ),
      line(
        "Dan",
        "Exactly. Updates often fix security problems.",
        "Đúng rồi. Bản cập nhật thường sửa các vấn đề bảo mật.",
      ),
    ],
    questions: [
      choice(
        "understand",
        "comprehension",
        "Dan khuyên Rina chọn mật khẩu thế nào?",
        ["password"],
        [
          "Mạnh và không dùng lại ở nơi khác",
          "Giống mật khẩu của Dan",
          "Giống tên thiết bị",
        ],
        0,
        "Dan nói rõ a strong password that you don't use anywhere else.",
      ),
      gap(
        "software",
        "I'll keep the ____ up to date.",
        "Keep the software up to date là duy trì các chương trình ở phiên bản mới.",
      ),
      choice(
        "sense",
        "meaning",
        "privacy settings trong đoạn liên quan đến việc gì?",
        ["privacy"],
        [
          "Kiểm soát ứng dụng nào xem được vị trí",
          "Tăng độ sáng màn hình",
          "Mua một thiết bị khác",
        ],
        0,
        "Ví dụ cụ thể là quyền truy cập vị trí, một phần của kiểm soát thông tin cá nhân.",
      ),
    ],
    reply:
      "Bạn là Rina. Hãy hỏi Dan cách kiểm tra quyền truy cập vị trí của một ứng dụng.",
  }),
  dialogue({
    id: "community-repair",
    title: "Bàn về một buổi sửa đồ trong khu dân cư",
    level: "B2",
    targets: [
      t(
        "environment",
        "noun",
        "môi trường",
        "môi trường tự nhiên bị ảnh hưởng bởi rác thải",
      ),
      t("reduce", "verb", "giảm", "giảm lượng đồ bị vứt đi"),
      t(
        "sustainable",
        "adjective",
        "bền vững",
        "có thể duy trì và ít gây hại môi trường",
      ),
      t("community", "noun", "cộng đồng", "nhóm cư dân cùng tổ chức hoạt động"),
    ],
    lines: [
      line(
        "Lena",
        "Our community is planning a repair afternoon next month.",
        "Cộng đồng của chúng tôi đang lên kế hoạch một buổi sửa đồ vào tháng tới.",
      ),
      line(
        "Omar",
        "What kinds of things will people bring?",
        "Mọi người sẽ mang những loại đồ gì đến?",
      ),
      line(
        "Lena",
        "Small appliances, clothes and furniture, if we have someone who can fix them.",
        "Đồ điện nhỏ, quần áo và nội thất, nếu có người sửa được chúng.",
      ),
      line(
        "Omar",
        "That could reduce the amount of useful stuff we throw away.",
        "Việc đó có thể giảm lượng đồ còn dùng được mà chúng ta vứt đi.",
      ),
      line(
        "Lena",
        "Exactly. It's a practical way to help the environment.",
        "Đúng vậy. Đó là một cách thiết thực để giúp môi trường.",
      ),
      line(
        "Omar",
        "How will you make the project sustainable beyond one afternoon?",
        "Các bạn sẽ làm sao để dự án bền vững sau buổi đó?",
      ),
      line(
        "Lena",
        "We'll start small, share the work and check whether volunteers want to return.",
        "Chúng tôi sẽ bắt đầu nhỏ, chia việc và hỏi xem tình nguyện viên có muốn quay lại không.",
      ),
      line(
        "Omar",
        "That sounds realistic. I can help with basic bike repairs.",
        "Nghe thực tế đấy. Tôi có thể giúp sửa xe đạp cơ bản.",
      ),
    ],
    questions: [
      choice(
        "understand",
        "comprehension",
        "Omar lo dự án có thể gặp vấn đề gì?",
        ["sustainable", "community"],
        [
          "Khó duy trì sau hoạt động đầu tiên",
          "Không ai được mang xe đạp",
          "Chỉ có đồ mới được nhận",
        ],
        0,
        "Beyond one afternoon là duy trì dự án lâu hơn một sự kiện đơn lẻ.",
      ),
      gap(
        "reduce",
        "That could ____ the amount of useful stuff we throw away.",
        "Reduce the amount là giảm lượng; từ theo sau could dùng dạng nguyên mẫu.",
      ),
      choice(
        "sense",
        "meaning",
        "sustainable có hai ý liên quan nào trong đoạn?",
        ["sustainable"],
        [
          "Có thể duy trì và giảm lãng phí",
          "Đắt tiền và làm nhanh",
          "Chỉ tổ chức một lần",
        ],
        0,
        "Hoạt động sửa đồ giảm lãng phí, còn chia việc giúp hoạt động có thể tiếp tục.",
      ),
    ],
    reply:
      "Bạn là Omar. Hãy đề nghị một cách giúp buổi sửa đồ diễn ra đều đặn mà không quá tải tình nguyện viên.",
  }),
  dialogue({
    id: "interview-questions",
    title: "Trao đổi trước một buổi phỏng vấn",
    level: "B2",
    targets: [
      t("applicant", "noun", "người ứng tuyển", "người nộp hồ sơ xin việc"),
      t("experience", "noun", "kinh nghiệm", "kinh nghiệm làm việc liên quan"),
      t(
        "qualification",
        "noun",
        "bằng cấp hoặc chứng chỉ",
        "bằng cấp chuyên môn được yêu cầu",
      ),
      t(
        "salary",
        "noun",
        "lương cố định theo tháng hoặc năm",
        "mức lương được trả hằng năm",
      ),
    ],
    lines: [
      line(
        "Ella",
        "The advert says each applicant needs two years of experience.",
        "Quảng cáo nói mỗi người ứng tuyển cần hai năm kinh nghiệm.",
      ),
      line(
        "Tom",
        "You have that from your last job, don't you?",
        "Bạn đã có kinh nghiệm đó từ công việc trước mà, phải không?",
      ),
      line(
        "Ella",
        "Yes, but I don't have the qualification they mention.",
        "Có, nhưng mình không có bằng cấp mà họ nhắc tới.",
      ),
      line(
        "Tom",
        "Does it say it's essential, or just preferred?",
        "Họ nói bắt buộc hay chỉ ưu tiên?",
      ),
      line(
        "Ella",
        "Preferred. Perhaps I should explain what I've learned on the job.",
        "Ưu tiên. Có lẽ mình nên giải thích những gì đã học được khi làm việc.",
      ),
      line(
        "Tom",
        "That sounds sensible. Have they listed the annual salary?",
        "Hợp lý đấy. Họ có ghi mức lương hằng năm không?",
      ),
      line(
        "Ella",
        "Only a range. I'll ask how they decide where a candidate fits within it.",
        "Chỉ có một khoảng. Mình sẽ hỏi họ căn cứ vào đâu để quyết định mức cho ứng viên.",
      ),
      line(
        "Tom",
        "Good. You can ask about training opportunities as well.",
        "Tốt. Bạn cũng có thể hỏi về cơ hội đào tạo.",
      ),
    ],
    questions: [
      choice(
        "understand",
        "comprehension",
        "Vì sao Ella vẫn có cơ sở để ứng tuyển?",
        ["experience", "qualification"],
        [
          "Cô có kinh nghiệm và bằng cấp chỉ là ưu tiên",
          "Công việc không yêu cầu kinh nghiệm",
          "Cô đã có mọi bằng cấp được nhắc tới",
        ],
        0,
        "Ella có hai năm kinh nghiệm; qualification được ghi là preferred, không phải essential.",
      ),
      gap(
        "salary",
        "Have they listed the annual ____?",
        "Annual salary là mức lương tính theo năm, không phải tiền công theo giờ.",
      ),
      choice(
        "sense",
        "meaning",
        "applicant trong câu đầu chỉ ai?",
        ["applicant"],
        [
          "Người nộp hồ sơ xin công việc",
          "Người đang phỏng vấn ứng viên",
          "Khách hàng của công ty",
        ],
        0,
        "Mỗi applicant là một người ứng tuyển; đây không phải người tuyển dụng.",
      ),
    ],
    reply:
      "Bạn là Ella. Hãy viết một câu lịch sự hỏi công ty liệu kinh nghiệm có thể thay cho bằng cấp được ưu tiên không.",
  }),
  dialogue({
    id: "seminar-preparation",
    title: "Chuẩn bị cho buổi thảo luận",
    level: "B2",
    targets: [
      t(
        "seminar",
        "noun",
        "buổi học thảo luận chuyên đề",
        "buổi học có trao đổi và câu hỏi",
      ),
      t("lecture", "noun", "bài giảng", "bài giảng đã nghe tuần trước"),
      t(
        "revision",
        "noun",
        "việc ôn tập trước kỳ thi",
        "việc ôn lại bài trước kỳ đánh giá",
      ),
      t(
        "assessment",
        "noun",
        "việc đánh giá kết quả học tập",
        "bài đánh giá kết quả học tập sắp tới",
      ),
    ],
    lines: [
      line(
        "Zoe",
        "Do we need to prepare anything for tomorrow's seminar?",
        "Chúng ta có cần chuẩn bị gì cho buổi thảo luận ngày mai không?",
      ),
      line(
        "Max",
        "Two questions about last week's lecture.",
        "Hai câu hỏi về bài giảng tuần trước.",
      ),
      line(
        "Zoe",
        "I'll reread my notes. It should help with revision for the assessment too.",
        "Mình sẽ đọc lại ghi chú. Việc đó cũng giúp ôn tập cho bài đánh giá.",
      ),
      line(
        "Max",
        "I'm not sure how the argument in the last section works.",
        "Mình chưa chắc cách lập luận ở phần cuối vận hành như thế nào.",
      ),
      line(
        "Zoe",
        "Let's make that our first question instead of trying to hide it.",
        "Hãy lấy đó làm câu hỏi đầu tiên thay vì cố giấu điều chưa hiểu.",
      ),
      line(
        "Max",
        "Agreed. The discussion will be more useful if we ask about what we don't understand.",
        "Đồng ý. Phần thảo luận sẽ hữu ích hơn nếu hỏi về điều chưa hiểu.",
      ),
    ],
    questions: [
      choice(
        "understand",
        "comprehension",
        "Hai người cần chuẩn bị gì?",
        ["seminar", "lecture"],
        [
          "Hai câu hỏi về bài giảng tuần trước",
          "Một bài giảng mới hoàn chỉnh",
          "Đáp án của bài đánh giá",
        ],
        0,
        "Max trả lời trực tiếp: Two questions about last week's lecture.",
      ),
      gap(
        "revision",
        "It should help with ____ for the assessment too.",
        "Revision ở đây là ôn tập để chuẩn bị cho bài đánh giá, không phải chỉnh sửa văn bản.",
      ),
      choice(
        "sense",
        "meaning",
        "seminar khác bài giảng được nhắc tới ở điểm nào trong tình huống?",
        ["seminar"],
        [
          "Có thảo luận và nêu câu hỏi",
          "Không được đặt câu hỏi",
          "Chỉ là một bài kiểm tra viết",
        ],
        0,
        "Hai người chuẩn bị câu hỏi và mong phần discussion giúp giải quyết điều chưa hiểu.",
      ),
    ],
    reply:
      "Bạn là Zoe. Hãy viết một câu hỏi lịch sự xin người hướng dẫn giải thích phần lập luận khó hiểu.",
  }),
  dialogue({
    id: "train-journey",
    title: "Hỏi vé và thời gian đi tàu",
    level: "B1",
    targets: [
      t(
        "journey",
        "noun",
        "chuyến đi; hành trình",
        "chuyến tàu từ nơi khởi hành tới đích",
      ),
      t("fare", "noun", "giá vé", "số tiền trả cho chuyến tàu"),
      t("passenger", "noun", "hành khách", "một người đi trên tàu"),
      t("railway", "noun", "đường sắt", "hệ thống đường sắt đang được sửa"),
    ],
    lines: [
      line(
        "Ivy",
        "How long is the journey to Westford?",
        "Chuyến đi tới Westford mất bao lâu?",
      ),
      line(
        "Chris",
        "About an hour, but there's work on the railway this weekend.",
        "Khoảng một giờ, nhưng cuối tuần này có thi công trên đường sắt.",
      ),
      line(
        "Ivy",
        "What's the fare for one adult passenger?",
        "Giá vé cho một hành khách người lớn là bao nhiêu?",
      ),
      line(
        "Chris",
        "Twelve pounds each way. The ticket is valid on the replacement bus too.",
        "Mười hai bảng mỗi chiều. Vé cũng dùng được trên xe buýt thay thế.",
      ),
      line(
        "Ivy",
        "Thanks. I'll leave extra time in case I need the bus.",
        "Cảm ơn. Tôi sẽ đi sớm hơn để có thêm thời gian nếu cần xe buýt.",
      ),
      line(
        "Chris",
        "That's wise. Check the departure board when you arrive.",
        "Làm vậy hợp lý đấy. Hãy xem bảng giờ khởi hành khi đến nơi.",
      ),
    ],
    questions: [
      choice(
        "understand",
        "comprehension",
        "Vì sao Ivy muốn dành thêm thời gian?",
        ["railway", "journey"],
        [
          "Có thi công đường sắt nên có thể cần xe buýt thay thế",
          "Vé chỉ có hiệu lực ngày mai",
          "Chuyến tàu luôn mất ba giờ",
        ],
        0,
        "Thi công cuối tuần có thể làm Ivy cần chuyển sang replacement bus.",
      ),
      gap(
        "fare",
        "What's the ____ for one adult passenger?",
        "Fare là giá vé của hành trình bằng phương tiện vận tải.",
      ),
      choice(
        "sense",
        "meaning",
        "passenger trong câu hỏi chỉ ai?",
        ["passenger"],
        ["Một người đi tàu", "Người lái tàu", "Người sửa đường ray"],
        0,
        "Adult passenger là một hành khách người lớn, không phải nhân viên vận hành.",
      ),
    ],
    reply:
      "Bạn là Ivy. Hãy hỏi chuyến sớm nhất sáng mai khởi hành lúc mấy giờ.",
  }),
  dialogue({
    id: "volunteer-shift",
    title: "Chọn một ca tình nguyện phù hợp",
    level: "B1",
    targets: [
      t(
        "volunteer",
        "noun",
        "tình nguyện viên",
        "người tham gia giúp đỡ không nhận lương",
      ),
      t(
        "charity",
        "noun",
        "tổ chức từ thiện",
        "tổ chức đang tuyển người giúp đỡ",
      ),
      t("opportunity", "noun", "cơ hội", "dịp để giúp đỡ và học kỹ năng"),
      t("support", "verb", "hỗ trợ; giúp đỡ", "giúp nhóm đóng gói thực phẩm"),
    ],
    lines: [
      line(
        "Kim",
        "I'd like to become a volunteer, but I can only help on Saturdays.",
        "Mình muốn làm tình nguyện viên, nhưng chỉ giúp được vào thứ Bảy.",
      ),
      line(
        "Ari",
        "The charity near my home needs people on Saturday mornings.",
        "Tổ chức từ thiện gần nhà mình cần người vào sáng thứ Bảy.",
      ),
      line("Kim", "What would I do there?", "Mình sẽ làm gì ở đó?"),
      line(
        "Ari",
        "You could support the team that packs food boxes.",
        "Bạn có thể hỗ trợ nhóm đóng gói các hộp thực phẩm.",
      ),
      line(
        "Kim",
        "That sounds like a useful opportunity. Would they train me?",
        "Nghe có vẻ là cơ hội hữu ích. Họ có hướng dẫn mình không?",
      ),
      line(
        "Ari",
        "Yes. Someone will show you what to do on your first shift.",
        "Có. Một người sẽ chỉ bạn cần làm gì trong ca đầu tiên.",
      ),
      line(
        "Kim",
        "Then I'll ask whether they have space for one more person.",
        "Vậy mình sẽ hỏi xem họ còn chỗ cho thêm một người không.",
      ),
      line(
        "Ari",
        "I'll send you their contact details.",
        "Mình sẽ gửi bạn thông tin liên hệ của họ.",
      ),
    ],
    questions: [
      choice(
        "understand",
        "comprehension",
        "Công việc nào phù hợp với thời gian của Kim?",
        ["volunteer", "support"],
        [
          "Hỗ trợ đóng hộp thực phẩm sáng thứ Bảy",
          "Làm việc mỗi tối trong tuần",
          "Dạy cả nhóm ngay ca đầu tiên",
        ],
        0,
        "Kim chỉ rảnh thứ Bảy, và tổ chức cần người vào sáng thứ Bảy; ca đầu có người hướng dẫn.",
      ),
      gap(
        "charity",
        "The ____ near my home needs people on Saturday mornings.",
        "Charity ở đây là một tổ chức từ thiện cụ thể, không phải hành động cho tiền nói chung.",
      ),
      choice(
        "sense",
        "meaning",
        "opportunity trong lời Kim chỉ điều gì?",
        ["opportunity"],
        [
          "Dịp tham gia giúp đỡ và học việc",
          "Một khoản lương mới",
          "Một nhiệm vụ bắt buộc ở trường",
        ],
        0,
        "Kim đánh giá cơ hội tham gia hoạt động, không có thông tin về nhận lương.",
      ),
    ],
    reply:
      "Bạn là Kim. Hãy viết một câu hỏi tổ chức xem có cần đăng ký trước ca đầu tiên không.",
  }),
  dialogue({
    id: "apartment-viewing",
    title: "Hỏi xem một căn hộ",
    level: "B1",
    targets: [
      t("apartment", "noun", "căn hộ", "căn hộ đang được cho thuê"),
      t(
        "available",
        "adjective",
        "có sẵn; có thể dùng hoặc lấy được",
        "căn hộ còn có thể thuê",
      ),
      t(
        "comfortable",
        "adjective",
        "thoải mái; dễ chịu",
        "không gian ở tạo cảm giác dễ chịu",
      ),
      t("neighbour", "noun", "người hàng xóm", "người sống ở căn hộ bên cạnh"),
    ],
    lines: [
      line(
        "Finn",
        "Is the apartment still available?",
        "Căn hộ vẫn còn cho thuê chứ?",
      ),
      line(
        "Sara",
        "Yes. Would you like to see it on Thursday?",
        "Vâng. Bạn muốn xem vào thứ Năm không?",
      ),
      line(
        "Finn",
        "That would be great. It looks comfortable in the photos.",
        "Thế thì tốt quá. Trong ảnh trông căn hộ có vẻ thoải mái.",
      ),
      line(
        "Sara",
        "It's small, but there's plenty of natural light.",
        "Nó nhỏ, nhưng có nhiều ánh sáng tự nhiên.",
      ),
      line(
        "Finn",
        "Is it quiet? I work from home, and a noisy neighbour could be a problem.",
        "Ở đó yên tĩnh không? Tôi làm việc tại nhà, nên hàng xóm ồn ào có thể là vấn đề.",
      ),
      line(
        "Sara",
        "The building is usually quiet. Come at five and you can judge for yourself.",
        "Tòa nhà thường yên tĩnh. Bạn đến lúc năm giờ rồi tự đánh giá nhé.",
      ),
    ],
    questions: [
      choice(
        "understand",
        "comprehension",
        "Vì sao Finn quan tâm đến tiếng ồn?",
        ["neighbour", "apartment"],
        [
          "Anh ấy làm việc tại nhà",
          "Anh ấy muốn mở một câu lạc bộ",
          "Anh ấy đã ký hợp đồng thuê",
        ],
        0,
        "Finn giải thích trực tiếp I work from home, nên tiếng ồn có thể ảnh hưởng công việc.",
      ),
      gap(
        "available",
        "Is the apartment still ____?",
        "Available ở đây là căn hộ vẫn còn để thuê, chưa có người thuê mất.",
      ),
      choice(
        "sense",
        "meaning",
        "comfortable trong tình huống này có nghĩa gì?",
        ["comfortable"],
        [
          "Không gian có vẻ dễ chịu để ở",
          "Chắc chắn rất rộng",
          "Đã bao gồm mọi hóa đơn",
        ],
        0,
        "Comfortable diễn tả cảm giác dễ chịu; Sara còn nói căn hộ nhỏ, và không đề cập hóa đơn.",
      ),
    ],
    reply: "Bạn là Finn. Hãy xác nhận giờ xem nhà và hỏi địa chỉ cụ thể.",
  }),
  dialogue({
    id: "weighing-a-choice",
    title: "Cân nhắc một quyết định khó",
    level: "B2",
    targets: [
      t(
        "consider",
        "verb",
        "cân nhắc; xem xét",
        "xem xét một lời mời công việc",
      ),
      t("decision", "noun", "quyết định", "lựa chọn có nhận việc hay không"),
      t("benefit", "noun", "lợi ích", "điểm tích cực của việc nhận công việc"),
      t(
        "challenge",
        "noun",
        "thử thách",
        "khó khăn phải thích nghi khi chuyển đi",
      ),
    ],
    lines: [
      line(
        "Mina",
        "I've been offered a job in another city, and I need to consider it carefully.",
        "Mình được mời làm việc ở thành phố khác và cần cân nhắc kỹ.",
      ),
      line(
        "Jules",
        "What's the main benefit of taking it?",
        "Lợi ích chính khi nhận công việc đó là gì?",
      ),
      line(
        "Mina",
        "I'd learn a lot, but moving away would be a challenge.",
        "Mình sẽ học được nhiều, nhưng chuyển đi sẽ là một thử thách.",
      ),
      line(
        "Jules",
        "Have you spoken to anyone who works there?",
        "Bạn đã nói chuyện với ai đang làm ở đó chưa?",
      ),
      line(
        "Mina",
        "Not yet. I don't want to make the decision based only on the salary.",
        "Chưa. Mình không muốn quyết định chỉ dựa vào lương.",
      ),
      line(
        "Jules",
        "Then ask about the team and what a normal week looks like.",
        "Vậy hãy hỏi về nhóm và một tuần làm việc bình thường như thế nào.",
      ),
      line(
        "Mina",
        "Good idea. I also need to work out what living there would cost.",
        "Ý hay đấy. Mình cũng cần tính xem sống ở đó sẽ tốn bao nhiêu.",
      ),
      line(
        "Jules",
        "Once you know more, you can compare the offer with what matters most to you.",
        "Khi biết thêm, bạn có thể so lời mời với điều quan trọng nhất với mình.",
      ),
    ],
    questions: [
      choice(
        "understand",
        "comprehension",
        "Mina muốn tránh điều gì khi quyết định?",
        ["decision", "consider"],
        ["Chỉ dựa vào mức lương", "Tìm hiểu về nhóm", "Tính chi phí sinh hoạt"],
        0,
        "Mina nói rõ I don't want to make the decision based only on the salary.",
      ),
      gap(
        "challenge",
        "Moving away would be a ____.",
        "Challenge là thử thách phải đối mặt; không có nghĩa Mina chắc chắn sẽ từ chối.",
      ),
      choice(
        "sense",
        "meaning",
        "benefit được nói đến cụ thể là gì?",
        ["benefit"],
        [
          "Cơ hội học được nhiều từ công việc",
          "Một bảo đảm rằng chuyển đi rất dễ",
          "Mức lương đã được nêu chính xác",
        ],
        0,
        "Mina trả lời câu hỏi lợi ích bằng I'd learn a lot; cô đồng thời thừa nhận khó khăn khi chuyển đi.",
      ),
    ],
    reply:
      "Bạn là Mina. Hãy viết một câu hỏi nhà tuyển dụng về cơ hội học tập trong nhóm.",
  }),
  dialogue({
    id: "preparing-for-a-visit",
    title: "Chia việc trước khi người thân đến chơi",
    level: "B1",
    targets: [
      {
        ...t(
          "clean",
          "verb",
          "làm sạch; lau dọn",
          "lau dọn nhà bếp trước khi khách đến",
        ),
        id: "clean-verb-01",
      },
      {
        ...t(
          "shop",
          "verb",
          "mua sắm; đi mua hàng",
          "đi mua thực phẩm để chuẩn bị bữa trưa",
        ),
        id: "shop-verb-01",
      },
      {
        ...t(
          "drink",
          "verb",
          "uống",
          "uống cà phê; ở đây người khách không uống cà phê",
        ),
        id: "drink-verb-01",
      },
      {
        ...t("open", "verb", "mở", "mở cửa sổ bếp để không khí vào"),
        id: "open-verb-01",
      },
    ],
    lines: [
      line(
        "Maya",
        "My older sister's coming over this afternoon. What do we need to do first?",
        "Chiều nay chị gái mình đến chơi. Mình cần làm gì trước nhỉ?",
      ),
      line(
        "Ben",
        "I'll clean the kitchen while you shop for groceries.",
        "Mình sẽ lau dọn bếp trong lúc bạn đi mua thực phẩm.",
      ),
      line(
        "Maya",
        "Sure. We already have coffee. Should I buy some juice too?",
        "Được. Mình có cà phê rồi. Mình có nên mua thêm nước ép không?",
      ),
      line(
        "Ben",
        "Yes, please. She doesn't drink coffee.",
        "Có, mua giúp nhé. Chị ấy không uống cà phê.",
      ),
      line("Maya", "Anything else?", "Còn gì nữa không?"),
      line(
        "Ben",
        "Could you open the kitchen window before you leave? It's hot in here.",
        "Bạn mở cửa sổ bếp trước khi đi được không? Trong này nóng quá.",
      ),
      line(
        "Maya",
        "Of course. I'll get the groceries, and we can make lunch when I get back.",
        "Được chứ. Mình sẽ mua thực phẩm, rồi khi mình về thì cả hai cùng nấu bữa trưa.",
      ),
      line(
        "Ben",
        "Great. I'll have the kitchen ready by then.",
        "Tốt quá. Đến lúc đó mình sẽ dọn bếp xong.",
      ),
    ],
    questions: [
      {
        ...choice(
          "understand",
          "comprehension",
          "Maya và Ben chia việc thế nào?",
          [],
          [
            "Ben dọn bếp, Maya đi mua thực phẩm",
            "Cả hai cùng đi mua thực phẩm ngay",
            "Maya dọn bếp, Ben đi mua nước ép",
          ],
          0,
          "Ben nói I'll clean the kitchen while you shop for groceries: Ben dọn bếp, còn Maya mua thực phẩm.",
        ),
        targetIds: ["clean-verb-01", "shop-verb-01"],
      },
      {
        ...gap(
          "drink",
          "She doesn't ____ coffee.",
          "Drink là động từ uống. Sau doesn't dùng nguyên mẫu drink; Ben giải thích vì sao nên mua thêm nước ép.",
        ),
        targetIds: ["drink-verb-01"],
      },
      {
        ...choice(
          "sense",
          "meaning",
          "Open the kitchen window trong lời Ben yêu cầu làm gì?",
          [],
          [
            "Mở cửa sổ bếp để không khí vào",
            "Tìm một cửa hàng đang mở cửa",
            "Bắt đầu kinh doanh một quán cà phê",
          ],
          0,
          "Open ở đây là động từ mở cửa sổ; không phải tính từ chỉ trạng thái mở hay nghĩa bắt đầu kinh doanh.",
        ),
        targetIds: ["open-verb-01"],
      },
    ],
    reply: "Bạn là Maya. Hãy hỏi Ben muốn mua loại trái cây nào cho bữa trưa.",
  }),
  dialogue({
    id: "booking-a-later-train",
    title: "Đặt chuyến tàu có đủ thời gian nối chuyến",
    level: "B1",
    targets: [
      {
        ...t(
          "book",
          "verb",
          "đặt trước (vé hoặc dịch vụ)",
          "đặt trước vé tàu cho chuyến đi thứ Bảy",
        ),
        id: "book-verb-01",
      },
      {
        ...t(
          "search",
          "verb",
          "tìm kiếm; lục tìm",
          "tìm chuyến khởi hành muộn hơn trên website của hãng tàu",
        ),
        id: "search-verb-01",
      },
      {
        ...t(
          "miss",
          "verb",
          "lỡ xe hoặc chuyến bay vì đến muộn",
          "lỡ tàu vì xe buýt đến ga quá muộn",
        ),
        id: "miss-verb-transport-01",
      },
    ],
    lines: [
      line(
        "Alex",
        "Can we book tickets for the nine o'clock train on Saturday?",
        "Mình đặt vé chuyến tàu chín giờ sáng thứ Bảy được không?",
      ),
      line(
        "Sam",
        "Let's search the train company's website for a later departure first.",
        "Trước hết mình tìm chuyến khởi hành muộn hơn trên website của hãng tàu nhé.",
      ),
      line(
        "Alex",
        "Why a later one? Tickets for the earlier train are cheaper.",
        "Sao lại chọn chuyến muộn hơn? Vé chuyến sớm rẻ hơn mà.",
      ),
      line(
        "Sam",
        "Our bus gets to the station at eight fifty. If it's late, we could miss the nine o'clock train.",
        "Xe buýt của mình đến ga lúc tám giờ năm mươi. Nếu xe đến trễ thì mình có thể lỡ chuyến tàu chín giờ.",
      ),
      line(
        "Alex",
        "Good point. There's a train at ten fifteen, and the tickets cost only a little more.",
        "Bạn nói đúng. Có chuyến lúc mười giờ mười lăm, mà vé chỉ đắt hơn một chút.",
      ),
      line(
        "Sam",
        "Let's book those, then. That gives us time if the bus is delayed.",
        "Vậy đặt vé chuyến đó nhé. Như thế mình có thêm thời gian nếu xe buýt đến trễ.",
      ),
    ],
    questions: [
      {
        ...choice(
          "understand",
          "comprehension",
          "Vì sao Sam muốn tìm chuyến tàu muộn hơn?",
          [],
          [
            "Chuyến muộn hơn chắc chắn có vé rẻ nhất",
            "Xe buýt đến ga sát giờ tàu chạy, nên trễ xe có thể làm họ lỡ tàu",
            "Hãng tàu không bán vé chuyến chín giờ",
          ],
          1,
          "Xe buýt dự kiến đến lúc 8:50, chỉ mười phút trước chuyến tàu 9:00; Sam lo xe buýt đến trễ.",
        ),
        targetIds: ["search-verb-01", "miss-verb-transport-01"],
      },
      {
        ...gap(
          "miss",
          "If it's late, we could ____ the nine o'clock train.",
          "Miss the train là lỡ chuyến vì đến không kịp; khác với miss somebody nghĩa nhớ một người.",
        ),
        targetIds: ["miss-verb-transport-01"],
      },
      {
        ...choice(
          "sense",
          "meaning",
          "Book tickets trong câu đầu có nghĩa gì?",
          [],
          [
            "Đọc một quyển sách trong lúc chờ tàu",
            "Đổi tên các vé đã mua",
            "Đặt trước vé cho chuyến đi sắp tới",
          ],
          2,
          "Book là động từ đặt trước vé hoặc dịch vụ. Đoạn này không nói đến danh từ book là sách và cũng không nêu quy tắc phải trả tiền ngay.",
        ),
        targetIds: ["book-verb-01"],
      },
    ],
    reply:
      "Bạn là Alex. Hãy đề nghị giờ rời nhà để có đủ thời gian bắt xe buýt đến ga.",
  }),
];

const normalize = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");

export function availableDialogues(state: State, pool = dialogues): Dialogue[] {
  return pool.filter((d) =>
    d.targets.every((target) => {
      const e = state.entries[target.id];
      return (
        e &&
        !e.archived &&
        canPractice(e.word, 0) &&
        normalize(e.word.word) === normalize(target.lemma) &&
        normalize(e.word.part_of_speech || "") ===
          normalize(target.partOfSpeech) &&
        normalize(e.word.meaning_vi) === normalize(target.meaning)
      );
    }),
  );
}

export type DialogueRecommendation = {
  dialogue: Dialogue;
  studied: number;
  weak: number;
  reason: string;
  personalized: boolean;
  /** Number of the explicitly requested current senses present in this text. */
  matched: number;
};

/** Recommend only an authored text that can actually practise at least three
 * of these senses. Never promise a generic dialogue can contain arbitrary IDs. */
export function conversationPracticeIds(
  state: State,
  candidateIds: readonly string[],
): string[] {
  const requested = new Set(candidateIds);
  const matches = availableDialogues(state)
    .map((dialogue) => ({
      id: dialogue.id,
      ids: dialogue.targets
        .filter((target) => requested.has(target.id))
        .map((target) => target.id),
    }))
    .filter((match) => match.ids.length >= 3)
    .sort((a, b) => b.ids.length - a.ids.length || a.id.localeCompare(b.id));
  return matches[0]?.ids || [];
}

export function recommendDialogues(
  state: State,
  options: {
    level?: string;
    length?: string;
    weakOnly?: boolean;
    targetIds?: readonly string[];
    now?: number;
  } = {},
): DialogueRecommendation[] {
  const now = options.now ?? Date.now();
  const evidence = selectLearningEvidence(state, now);
  const studied = new Set(evidence.current.map((result) => result.wordId));
  const requested = new Set(options.targetIds || []);
  // Merely showing this dialogue also records exposure. Counting those newly
  // visible words here would falsely turn a first-use example into a personal
  // recommendation during the same render. Require enrolment or actual saved
  // practice instead; exposure remains useful for independent-recall timing.
  for (const [id, entry] of Object.entries(state.entries))
    if (entry.enrolled) studied.add(id);
  const currentConversations = (state.conversations || []).filter((attempt) =>
    validEvidenceTime(attempt.time, now),
  );
  for (const attempt of currentConversations)
    for (const id of attempt.targetIds) {
      const entry = state.entries[id];
      if (
        entry &&
        !entry.archived &&
        attempt.targetContentVersions[id] === contentKey(entry.word)
      )
        studied.add(id);
    }
  const weak = new Set<string>();
  for (const results of evidence.attemptsBySkill.values())
    if (isWeakEvidence(results)) weak.add(results[0].wordId);
  const lastAnswers = new Map<string, boolean>();
  for (const a of [...currentConversations].sort((a, b) => a.time - b.time)) {
    for (const id of a.targetIds) {
      const tested = a.answers.filter(
        (answer) =>
          answer.targetIds.includes(id) && typeof answer.correct === "boolean",
      );
      if (
        tested.length &&
        a.targetContentVersions[id] ===
          (state.entries[id] && contentKey(state.entries[id].word))
      )
        lastAnswers.set(
          id,
          tested.every((answer) => answer.correct === true),
        );
    }
  }
  for (const [id, correct] of lastAnswers) if (!correct) weak.add(id);
  const lastPractised = new Map<string, number>();
  for (const a of currentConversations)
    lastPractised.set(
      a.dialogueId,
      Math.max(lastPractised.get(a.dialogueId) || 0, a.time),
    );
  return availableDialogues(state)
    .filter(
      (d) =>
        (!options.level || d.level === options.level) &&
        (!options.length ||
          (options.length === "short"
            ? d.lines.length <= 6
            : d.lines.length > 6)),
    )
    .map((d) => {
      const count = d.targets.filter((t) => studied.has(t.id)).length;
      const weakCount = d.targets.filter((t) => weak.has(t.id)).length;
      const matched = d.targets.filter((target) =>
        requested.has(target.id),
      ).length;
      return {
        dialogue: d,
        studied: count,
        weak: weakCount,
        personalized: count >= 3,
        matched,
        reason:
          count >= 3
            ? `${count}/${d.targets.length} từ đã chọn học hoặc luyện theo nghĩa hiện tại${weakCount ? `; ${weakCount} từ cần củng cố` : ""}.`
            : count
              ? `Có ${count}/${d.targets.length} từ đã chọn học hoặc luyện theo nghĩa hiện tại; chưa đủ 3 từ để cá nhân hóa trọn đoạn.`
              : "Bài mẫu biên soạn sẵn từ kho đã rà; chưa có lịch sử phù hợp để cá nhân hóa.",
      };
    })
    .filter(
      (r) =>
        (!options.weakOnly || r.weak > 0) && (!requested.size || r.matched > 0),
    )
    .sort(
      (a, b) =>
        b.matched - a.matched ||
        Number(b.personalized) - Number(a.personalized) ||
        b.weak - a.weak ||
        b.studied - a.studied ||
        (lastPractised.get(a.dialogue.id) || 0) -
          (lastPractised.get(b.dialogue.id) || 0) ||
        a.dialogue.id.localeCompare(b.dialogue.id),
    );
}

export function evaluateDialogueAnswer(
  question: DialogueQuestion,
  answer: string,
  supported = true,
): ConversationAnswer {
  const correct = question.accepted.some(
    (accepted) => normalize(answer) === normalize(accepted),
  );
  return {
    questionId: question.id,
    kind: question.kind,
    answer: answer.trim(),
    correct,
    targetIds: question.targetIds,
    explanation:
      question.kind === "cloze"
        ? `Bài khôi phục từ trong lời gốc, không chấm mọi cách điền có thể đúng ngữ pháp. ${question.explanation}`
        : question.explanation,
    // Hiding the transcript is still immediate practice, never proof of
    // delayed recall or an automatic SRS/mastery update.
    hint: supported,
  };
}

export function makeConversationAttempt(
  state: State,
  d: Dialogue,
  values: Record<string, string>,
  audio: {
    lines: string[];
    complete: boolean;
    hidden?: boolean;
    usedHint?: boolean;
  },
  retryOf?: string,
): ConversationAttempt {
  const supported =
    audio.hidden !== true || audio.usedHint === true || !!retryOf;
  const answers = d.questions.map((q) =>
    evaluateDialogueAnswer(q, values[q.id] || "", supported),
  );
  if (values.reply?.trim())
    answers.push({
      questionId: "reply",
      kind: "reply",
      answer: values.reply.trim(),
      targetIds: d.targets.map((t) => t.id),
      explanation:
        "Câu trả lời mở được lưu để tự xem lại; chưa thể chấm tự động ngữ pháp hoặc cách dùng từ ở đây.",
      hint: supported,
    });
  return {
    id: crypto.randomUUID(),
    dialogueId: d.id,
    dialogueVersion: d.version,
    time: Date.now(),
    targetIds: d.targets.map((t) => t.id),
    targetContentVersions: Object.fromEntries(
      d.targets.map((t) => [t.id, contentKey(state.entries[t.id].word)]),
    ),
    answers,
    read: true,
    listenedLineIds: audio.lines,
    listenedComplete: audio.complete,
    ...(retryOf ? { retryOf } : {}),
  };
}
